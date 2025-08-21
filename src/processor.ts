import { setTimeout } from 'worker-timers';

interface MediaStreamTrackProcessor {
    readable: ReadableStream;
}

declare global {
    interface Window {
        MediaStreamTrackProcessor: new ({
            track,
        }: {
            track: MediaStreamTrack;
        }) => MediaStreamTrackProcessor;
    }
}

class FallbackProcessor implements MediaStreamTrackProcessor {
    readonly readable: ReadableStream;

    constructor({ track }: { track: MediaStreamTrack }) {
        if (!track) throw new Error('MediaStreamTrack is required');
        if (track.kind !== 'video') {
            throw new Error('MediaStreamTrack must be video');
        }
        let running = true;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.srcObject = new MediaStream([track]);
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context from OffscreenCanvas');
        let timestamp = 0;
        let frameDuration = 1000 / 30;
        const close = () => {
            video.pause();
            video.srcObject = null;
            video.src = '';
        };
        this.readable = new ReadableStream({
            start: async () => {
                await Promise.all([
                    video.play(),
                    new Promise((r) => video.addEventListener('loadeddata', r, { once: true })),
                ]);
                frameDuration = 1000 / (track.getSettings().frameRate || 30);
                timestamp = performance.now();
                console.log(`[virtual-background] processor start frameDuration=${frameDuration}`);
            },
            pull: async (controller) => {
                if (!running) {
                    controller.close();
                    close();
                    return;
                }
                const delta = performance.now() - timestamp;
                if (delta < frameDuration) {
                    await new Promise((r) => setTimeout(r, frameDuration - delta));
                }
                timestamp = performance.now();
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                controller.enqueue(new VideoFrame(canvas, { timestamp }));
            },
            cancel: (reason) => {
                console.log(`[virtual-background] video processor cancelled: ${reason}`);
                running = false;
                close();
            },
        });
        const trackStop = track.stop.bind(track);
        track.stop = () => {
            trackStop();
            running = false;
        };
    }
}

const TrackProcessor =
    'MediaStreamTrackProcessor' in window ? window.MediaStreamTrackProcessor : FallbackProcessor;
export { TrackProcessor };

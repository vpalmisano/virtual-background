import { runSegmenter } from './segmenter';

type MediaStreamTrackProcessor = {
    readable: ReadableStream;
};

declare global {
    interface Window {
        MediaStreamTrackProcessor: new ({
            track,
        }: {
            track: MediaStreamTrack;
        }) => MediaStreamTrackProcessor;
    }
}

export type ProcessVideoTrackOptions = {
    smoothing: number;
    smoothstepMin: number;
    smoothstepMax: number;
    localAssets: boolean;
    runWorker: boolean;
    backgroundImageUrl: string;
    enableFilters: boolean;
    blur: number;
    brightness: number;
    contrast: number;
    gamma: number;
};

/**
 * Configuration options for the virtual background.
 */
const opts = {
    localAssets: false,
    runWorker: false,
    backgroundImageUrl: '',
    smoothing: 0.8,
    smoothstepMin: 0.75,
    smoothstepMax: 0.9,
    enableFilters: false,
    blur: 0,
    brightness: 0,
    contrast: 1,
    gamma: 1,
};

let worker: Worker | null = null;

export const options = new Proxy(opts, {
    get: function (target, prop) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Reflect.get(target, prop);
    },
    set: function (target, prop, value) {
        const ret = Reflect.set(target, prop, value);
        if (worker) {
            worker.postMessage({ name: 'options', options: { ...target } });
        }
        return ret;
    },
});

/**
 * Opens a file selector to allow the user to select an image file for the virtual background.
 */
export function updateBackground() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
        const files = input.files;
        if (files && files.length > 0) {
            const file = files[0];
            const imageUrl = URL.createObjectURL(file);
            options.backgroundImageUrl = imageUrl;
        }
    };
    input.click();
}

/**
 * Applies a virtual background to the provided MediaStreamTrack.
 * @param track - The MediaStreamTrack to apply the virtual background to.
 * @param opts - Optional configuration options for the virtual background.
 * @returns A Promise that resolves to the processed MediaStreamTrack.
 */
export async function processVideoTrack(track: MediaStreamTrack, opts?: ProcessVideoTrackOptions) {
    Object.assign(options, opts);

    const trackSettings = track.getSettings();
    const trackConstraints = track.getConstraints();
    const { width, height, frameRate } = trackSettings;
    console.log(`processVideoTrack: ${width}x${height} ${frameRate}fps`);

    const { readable } = new window.MediaStreamTrackProcessor({ track });

    const canvas = document.createElement('canvas');
    const outputTrack = canvas.captureStream(frameRate).getVideoTracks()[0];
    const offscreen = canvas.transferControlToOffscreen();

    const outputTrackStop = outputTrack.stop.bind(outputTrack);
    outputTrack.stop = () => {
        console.log('processVideoTrack outputTrack stop');
        outputTrackStop();
        track.stop();
    };
    outputTrack.getSettings = () => trackSettings;
    outputTrack.getConstraints = () => trackConstraints;
    track.addEventListener('ended', () => outputTrack.stop());

    if (options.runWorker) {
        if (!worker) {
            worker = new Worker(
                /* webpackChunkName: "worker" */ new URL('./worker.ts', import.meta.url)
            );
        }
        worker.postMessage(
            { name: 'runSegmenter', canvas: offscreen, readable, options: { ...options } },
            [offscreen, readable]
        );
    } else {
        await runSegmenter(offscreen, readable, options);
    }

    return outputTrack;
}

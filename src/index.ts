import { ImageSegmenter, FilesetResolver, ImageSegmenterResult } from '@mediapipe/tasks-vision';

import { WebGLRenderer } from './renderer';
import { VideoFilter, filterVideoFrame } from './filter';

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
    smoothing?: number;
    smoothstepMin?: number;
    smoothstepMax?: number;
    localAssets?: boolean;
    blur?: number;
    brightness?: number;
    contrast?: number;
    gamma?: number;
};

/**
 * Configuration options for the virtual background.
 */
export const options = {
    smoothing: 0.8,
    smoothstepMin: 0.75,
    smoothstepMax: 0.9,
    localAssets: false,
    backgroundImageUrl: '',
    enableFilters: false,
    blur: 0,
    brightness: 0,
    contrast: 1,
    gamma: 1,
};

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
export async function processVideoTrack(
    track: MediaStreamTrack,
    opts?: ProcessVideoTrackOptions
): Promise<MediaStreamTrack> {
    Object.assign(options, opts);

    const trackSettings = track.getSettings();
    const { width, height, frameRate } = trackSettings;
    console.log(`processVideoTrack: ${width}x${height} ${frameRate}fps`);

    const webGLRenderer = new WebGLRenderer();

    // Segmenter.
    const fileset = await FilesetResolver.forVisionTasks(
        options.localAssets
            ? 'mediapipe/tasks-vision/wasm'
            : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    const segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
            modelAssetPath: options.localAssets
                ? 'mediapipe/models/selfie_multiclass_256x256.tflite'
                : 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
            delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
        canvas: webGLRenderer.canvas,
    });

    // Filters.
    const effectsCanvas = new OffscreenCanvas(1, 1);
    const effectsGl = effectsCanvas.getContext('webgl2');
    if (!effectsGl) {
        throw new Error('WebGL2 not supported or canvas context failed.');
    }
    const videoFilter = new VideoFilter(effectsGl);

    // Replace track.
    const trackConstraints = track.getConstraints();
    const trackProcessor = new window.MediaStreamTrackProcessor({ track });
    const outputTrack = webGLRenderer.getVideoTrack(frameRate);

    const outputTrackStop = outputTrack.stop.bind(outputTrack);
    outputTrack.stop = () => {
        console.log('processVideoTrack outputTrack stop');
        outputTrackStop();
        track.stop();
        segmenter.close();
        webGLRenderer.close();
        videoFilter.destroy();
    };
    outputTrack.getSettings = () => trackSettings;
    outputTrack.getConstraints = () => trackConstraints;
    track.addEventListener('ended', () => outputTrack.stop());

    const writer = new WritableStream({
        async write(videoFrame: VideoFrame) {
            const { codedWidth, codedHeight } = videoFrame;
            if (!codedWidth || !codedHeight) {
                videoFrame.close();
                return;
            }
            if (options.enableFilters) {
                filterVideoFrame(
                    effectsCanvas,
                    effectsGl,
                    videoFilter,
                    videoFrame,
                    options.blur,
                    options.brightness,
                    options.contrast,
                    options.gamma
                );
            }
            await new Promise<void>((resolve) => {
                segmenter.segmentForVideo(
                    options.enableFilters ? effectsCanvas : videoFrame,
                    performance.now(),
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    async (result) => {
                        try {
                            if (
                                !result.categoryMask ||
                                !result.confidenceMasks ||
                                !result.confidenceMasks[0]
                            ) {
                                console.warn('Skipping frame: Missing masks or WebGL data.');
                                return;
                            }
                            const categoryMask = result.categoryMask;
                            const confidenceMask = result.confidenceMasks[0];
                            const categoryTextureMP = categoryMask.getAsWebGLTexture();
                            const confidenceTextureMP = confidenceMask.getAsWebGLTexture();

                            if (categoryTextureMP && confidenceTextureMP) {
                                await webGLRenderer.render(
                                    categoryTextureMP,
                                    confidenceTextureMP,
                                    videoFrame,
                                    options
                                );
                            }
                            categoryMask.close();
                            confidenceMask.close();
                        } catch (e) {
                            console.error('Error in videoCallback:', e);
                        } finally {
                            videoFrame.close();
                            resolve();
                        }
                    }
                );
            });
        },
        close() {
            console.log('processVideoTrack close');
        },
        abort(reason) {
            console.log('processVideoTrack abort', reason);
        },
    });
    trackProcessor.readable.pipeTo(writer).catch((err: unknown) => {
        console.error(`video error: ${(err as Error).message}`);
    });

    return outputTrack;
}

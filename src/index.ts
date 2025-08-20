import { Graph } from './graph';
import { runSegmenter, SegmenterStats } from './segmenter';
import { TrackProcessor } from './processor';

declare global {
    interface HTMLVideoElement {
        captureStream: (frameRate: number) => MediaStream;
    }
}

export type BackgroundSource = {
    type: string;
    media?: ImageBitmap | ReadableStream;
    url: string;
    video?: HTMLVideoElement;
    track?: MediaStreamTrack;
};

export type ProcessVideoTrackOptions = {
    wasmLoaderPath: string;
    wasmBinaryPath: string;
    modelPath: string;
    runWorker: boolean;
    // Virtual background options.
    enabled: boolean;
    backgroundUrl: string;
    backgroundSource?: BackgroundSource | null;
    showStats: boolean;
    // Segmenter options.
    borderSmooth: number;
    smoothing: number;
    smoothstepMin: number;
    smoothstepMax: number;
    restartEvery: number;
    bgBlur: number;
    bgBlurRadius: number;
    // Filter options.
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
    wasmLoaderPath: 'mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
    wasmBinaryPath: 'mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
    modelPath: 'mediapipe/models/selfie_multiclass_256x256.tflite',
    runWorker: false,
    enabled: true,
    backgroundUrl: '',
    showStats: false,
    // Segmenter options.
    borderSmooth: 0.0,
    smoothing: 0.8,
    smoothstepMin: 0.6,
    smoothstepMax: 0.9,
    restartEvery: 0,
    bgBlur: 0.0,
    bgBlurRadius: 30,
    // Filter options.
    enableFilters: false,
    blur: 0,
    brightness: 0,
    contrast: 1,
    gamma: 1,
} as ProcessVideoTrackOptions;

let worker: Worker | null = null;

function getWorkerOptions() {
    const opts = { ...options };
    const transferables: Transferable[] = [];
    if (opts.backgroundSource?.media) {
        const { type, media, url } = opts.backgroundSource;
        opts.backgroundSource = { type, media, url };
        transferables.push(media);
    } else {
        delete opts.backgroundSource;
    }
    if (options.backgroundSource) {
        options.backgroundSource.media = undefined;
    }
    return { options: opts, transferables };
}

export const options = new Proxy(opts, {
    get: function (target, prop) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Reflect.get(target, prop);
    },
    set: function (target, prop, value) {
        if (prop === 'backgroundUrl' && target.backgroundUrl.startsWith('blob:')) {
            URL.revokeObjectURL(target.backgroundUrl);
        }
        const ret = Reflect.set(target, prop, value);
        if (prop === 'backgroundUrl') {
            unloadBackground();
            loadBackground()
                .then(() => {
                    if (worker) {
                        const { options, transferables } = getWorkerOptions();
                        worker.postMessage({ name: 'options', options }, transferables);
                    }
                })
                .catch((err) => {
                    console.error(`Failed to load background: ${err}`);
                });
        } else if (prop !== 'backgroundSource') {
            if (worker) {
                const { options, transferables } = getWorkerOptions();
                worker.postMessage({ name: 'options', options }, transferables);
            }
        }
        return ret;
    },
});

function unloadBackground() {
    if (options.backgroundSource) {
        options.backgroundSource.track?.stop();
        if (options.backgroundSource.video) {
            options.backgroundSource.video.pause();
            options.backgroundSource.video.src = '';
        }
        options.backgroundSource = null;
    }
}

async function loadBackground() {
    const url = options.backgroundUrl;
    if (!url) {
        return;
    }
    console.log(`[virtual-background] loadBackground url=${options.backgroundUrl}`);

    const response = await fetch(url);
    if (!response.ok) {
        console.error(
            `[virtual-background] Failed to fetch background source ${url} (status: ${response.status})`
        );
        return;
    }
    const contentType = response.headers.get('Content-Type');
    const blob = await response.blob();

    if (contentType?.startsWith('image/')) {
        const imageBitmap = await createImageBitmap(blob);
        options.backgroundSource = { type: 'image', media: imageBitmap, url };
    } else if (contentType?.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(blob);
        video.muted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        await video.play();

        await new Promise<void>((resolve, reject) => {
            video.addEventListener(
                'timeupdate',
                () => {
                    resolve();
                },
                { once: true }
            );
            video.addEventListener(
                'error',
                () => {
                    reject(new Error('Video load error'));
                },
                { once: true }
            );
        });
        const track = video.captureStream(30).getVideoTracks()[0];
        if (!track) {
            console.error(`Failed to capture stream for video ${url} (no video track)`);
            video.pause();
            URL.revokeObjectURL(video.src);
            video.src = '';
            return;
        }
        const { readable } = new TrackProcessor({ track });
        options.backgroundSource = { type: 'video', media: readable, url, video, track };
    } else {
        console.warn(
            `[virtual-background] Unsupported background source type: ${contentType} for ${url}`
        );
        return;
    }
    console.log(`[virtual-background] Background source loaded`, options.backgroundSource);
}

export async function saveBackground(file: File) {
    console.log(`[virtual-background] saveBackground`, file);
    const storageRoot = await navigator.storage.getDirectory();
    {
        const handle = await storageRoot.getFileHandle(`background`, { create: true });
        const fd = await handle.createWritable();
        const blob = new Blob([file], { type: file.type });
        await fd.write(blob);
        await fd.close();
    }
    {
        const handle = await storageRoot.getFileHandle(`background_type`, { create: true });
        const fd = await handle.createWritable();
        await fd.write(file.type);
        await fd.close();
    }
}

export async function loadBackgroundFromStorage() {
    try {
        const storageRoot = await navigator.storage.getDirectory();
        const handle = await storageRoot.getFileHandle(`background`);
        const file = await handle.getFile();
        const handleType = await storageRoot.getFileHandle(`background_type`);
        const type = await (await handleType.getFile()).text();
        const newFile = new File([file], 'background', { type });
        console.log(`[virtual-background] loadBackgroundFromStorage`, newFile);
        const url = URL.createObjectURL(newFile);
        options.backgroundUrl = url;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        // If the file does not exist, we simply ignore the error.
    }
}

/**
 * Opens a file selector to allow the user to select a file for the virtual background.
 */
export function updateBackground(url?: string) {
    if (!url) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = async () => {
            const files = input.files;
            if (files && files.length > 0) {
                const file = files[0];
                const url = URL.createObjectURL(file);
                options.backgroundUrl = url;
                await saveBackground(file);
            }
        };
        input.click();
    } else {
        options.backgroundUrl = url;
    }
}

let refcount = 0;

/**
 * Applies a virtual background to the provided MediaStreamTrack.
 * @param track - The MediaStreamTrack to apply the virtual background to.
 * @param opts - Optional configuration options for the virtual background.
 * @returns A Promise that resolves to the processed MediaStreamTrack.
 */
export async function processVideoTrack(track: MediaStreamTrack, opts?: ProcessVideoTrackOptions) {
    Object.assign(options, opts);

    refcount++;

    const trackCapabilities = track.getCapabilities();
    const trackSettings = track.getSettings();
    const trackConstraints = track.getConstraints();
    const { width, height, frameRate } = trackSettings;
    console.log(`[virtual-background] processVideoTrack: ${width}x${height} ${frameRate}fps`, {
        trackCapabilities,
        trackSettings,
        trackConstraints,
    });

    const { readable } = new TrackProcessor({ track });

    const canvas = document.createElement('canvas');
    const outputTrack = canvas.captureStream(frameRate).getVideoTracks()[0];
    const offscreen = canvas.transferControlToOffscreen();
    let graph: Graph | null = null;

    function onStats(stats: SegmenterStats) {
        if (options.showStats) {
            const { fps, delay } = stats;
            console.log(
                `[virtual-background] segmenter delay: ${delay.toFixed(3)}ms fps: ${fps.toFixed(3)}`
            );
            if (!graph) {
                graph = new Graph();
            }
            graph.push(fps, 'fps');
        } else {
            if (graph) {
                graph.remove();
                graph = null;
            }
        }
    }

    await loadBackgroundFromStorage();

    const outputTrackStop = outputTrack.stop.bind(outputTrack);
    outputTrack.stop = () => {
        console.log('[virtual-background] processVideoTrack outputTrack stop');
        outputTrackStop();
        track.stop();
        refcount--;
        if (!refcount) {
            unloadBackground();
            if (worker) {
                worker.terminate();
                worker = null;
            }
        }
        if (graph) {
            graph.remove();
            graph = null;
        }
    };
    outputTrack.getCapabilities = () => trackCapabilities;
    outputTrack.getSettings = () => trackSettings;
    outputTrack.getConstraints = () => trackConstraints;
    track.addEventListener('ended', () => outputTrack.stop());

    if (options.runWorker) {
        if (!worker) {
            worker = new Worker(
                /* webpackChunkName: "worker" */ new URL('./worker.ts', import.meta.url)
            );
        }
        const { options: workerOptions, transferables } = getWorkerOptions();
        transferables.push(offscreen, readable);
        worker.postMessage(
            { name: 'runSegmenter', canvas: offscreen, readable, options: workerOptions },
            transferables
        );
        worker.addEventListener('message', ({ data }) => {
            const { name, stats } = data as { name: string; stats: SegmenterStats };
            if (name === 'stats') {
                onStats(stats);
            }
        });
    } else {
        await runSegmenter(offscreen, readable, options, onStats);
    }

    return outputTrack;
}

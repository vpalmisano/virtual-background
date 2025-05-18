import { FilesetResolver, ImageSegmenter, MPMask } from '@mediapipe/tasks-vision';
import { WebGLRenderer } from './renderer';
import { VideoFilter } from './filter';
import { ProcessVideoTrackOptions } from 'src';

export let options = {} as ProcessVideoTrackOptions;

async function createSegmenter(canvas: OffscreenCanvas) {
    const localAssets = options.localAssets;
    console.log(`createSegmenter`, { canvas, localAssets });
    const fileset = await FilesetResolver.forVisionTasks(
        localAssets
            ? 'mediapipe/tasks-vision/wasm'
            : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    const segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
            modelAssetPath: localAssets
                ? 'mediapipe/models/selfie_multiclass_256x256.tflite'
                : 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
            delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
        canvas,
    });
    return segmenter;
}

export async function runSegmenter(
    canvas: OffscreenCanvas,
    readable: ReadableStream,
    opts: ProcessVideoTrackOptions
) {
    console.log(`runSegmenter`, { canvas, options, readable });
    options = opts;
    let webGLRenderer: WebGLRenderer | null = new WebGLRenderer(canvas);

    function onContextLost(event: Event) {
        console.log(`webglcontextlost (${!!webGLRenderer})`);
        event.preventDefault();
        if (webGLRenderer) {
            webGLRenderer.close();
            webGLRenderer = null;
        }
    }

    function onContextRestored() {
        console.log(`webglcontextrestored (${!!webGLRenderer})`);
        if (!webGLRenderer) {
            setTimeout(() => {
                webGLRenderer = new WebGLRenderer(canvas);
                attachCanvasEvents();
            }, 1000);
        }
    }

    function attachCanvasEvents() {
        canvas.addEventListener('webglcontextlost', onContextLost, { once: true });
        canvas.addEventListener('webglcontextrestored', onContextRestored, { once: true });
    }
    attachCanvasEvents();

    let segmenter = await createSegmenter(canvas);

    // Filters.
    const effectsCanvas = new OffscreenCanvas(1, 1);
    const videoFilter = new VideoFilter(effectsCanvas);

    let lastStatsTime = 0;
    let segmenterDelayTotal = 0;
    let frames = 0;
    let totalFrames = 0;

    function close() {
        segmenter.close();
        webGLRenderer?.close();
        webGLRenderer = null;
        videoFilter?.destroy();
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
    }

    const writer = new WritableStream(
        {
            async write(videoFrame: VideoFrame) {
                const { codedWidth, codedHeight, timestamp } = videoFrame;
                if (!codedWidth || !codedHeight) {
                    videoFrame.close();
                    return;
                }
                if (options.enableFilters) {
                    videoFilter.render(
                        videoFrame,
                        options.blur,
                        options.brightness,
                        options.contrast,
                        options.gamma
                    );
                }
                const start = performance.now();

                await new Promise<void>((resolve) => {
                    segmenter.segmentForVideo(
                        options.enableFilters ? effectsCanvas : videoFrame,
                        timestamp * 1000,
                        (result) => {
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
                                    webGLRenderer?.render(
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
                                resolve();
                            }
                        }
                    );
                });
                videoFrame.close();

                // Stats report.
                const now = performance.now();
                segmenterDelayTotal += now - start;
                frames++;
                totalFrames++;
                if (now - lastStatsTime > 5000) {
                    const avgDelay = segmenterDelayTotal / frames;
                    const fps = (1000 * frames) / (now - lastStatsTime);
                    console.log(
                        `segmenter delay: ${avgDelay.toFixed(3)}ms fps: ${fps.toFixed(3)} frames: ${frames}`
                    );
                    lastStatsTime = now;
                    segmenterDelayTotal = 0;
                    frames = 0;
                }

                // Restart segmenter to avoid memory leaks.
                if (options.restartEvery && totalFrames % options.restartEvery === 0) {
                    createSegmenter(canvas)
                        .then((newSegmenter) => {
                            const oldSegmenter = segmenter;
                            segmenter = newSegmenter;
                            oldSegmenter.close();
                        })
                        .catch((e) => {
                            console.error('Error restarting segmenter:', e);
                        });
                }
            },
            close() {
                console.log('runSegmenter close');
                close();
            },
            abort(reason) {
                console.log('runSegmenter abort', reason);
                close();
            },
        },
        new CountQueuingStrategy({ highWaterMark: 1 })
    );

    readable.pipeTo(writer).catch((err: unknown) => {
        console.error(`video error: ${(err as Error).message}`);
    });
}

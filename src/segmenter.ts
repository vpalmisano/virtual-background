import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { WebGLRenderer } from './renderer';
import { filterVideoFrame, VideoFilter } from './filter';
import { ProcessVideoTrackOptions } from 'src';

export let options = {} as ProcessVideoTrackOptions;

export async function runSegmenter(
    canvas: OffscreenCanvas,
    readable: ReadableStream,
    opts: ProcessVideoTrackOptions
) {
    console.log(`runSegmenter`, { canvas, options, readable });
    options = opts;
    let webGLRenderer: WebGLRenderer | null = new WebGLRenderer(canvas);

    canvas.addEventListener(
        'webglcontextlost',
        (event) => {
            console.log(`webglcontextlost (${!!webGLRenderer})`);
            event.preventDefault();
            if (webGLRenderer) {
                webGLRenderer.close();
                webGLRenderer = null;
            }
        },
        false
    );

    canvas.addEventListener(
        'webglcontextrestored',
        () => {
            console.log(`webglcontextrestored (${!!webGLRenderer})`);
            if (!webGLRenderer) {
                webGLRenderer = new WebGLRenderer(canvas);
            }
        },
        false
    );

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
        canvas,
    });

    // Filters.
    const effectsCanvas = new OffscreenCanvas(1, 1);
    const effectsGl = effectsCanvas.getContext('webgl2');
    if (!effectsGl) {
        throw new Error('WebGL2 not supported or canvas context failed.');
    }
    const videoFilter = new VideoFilter(effectsGl);

    function close() {
        segmenter.close();
        webGLRenderer?.close();
        webGLRenderer = null;
        videoFilter.destroy();
    }

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
                            videoFrame.close();
                            resolve();
                        }
                    }
                );
            });
        },
        close() {
            console.log('runSegmenter close');
            close();
        },
        abort(reason) {
            console.log('runSegmenter abort', reason);
            close();
        },
    });

    readable.pipeTo(writer).catch((err: unknown) => {
        console.error(`video error: ${(err as Error).message}`);
    });
}

import { ProcessVideoTrackOptions } from 'src';
import { runSegmenter, options } from './segmenter';

self.onmessage = ({ data }) => {
    const { name } = data as { name: string };
    if (name === 'options') {
        const { options: opts } = data as { options: ProcessVideoTrackOptions };
        Object.assign(options, opts);
    } else if (name === 'runSegmenter') {
        const {
            canvas,
            readable,
            options: opts,
        } = data as {
            canvas: OffscreenCanvas;
            readable: ReadableStream;
            options: ProcessVideoTrackOptions;
        };
        runSegmenter(canvas, readable, opts).catch((err: unknown) => {
            console.error(`video error: ${(err as Error).message}`);
        });
    }
};

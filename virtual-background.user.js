// ==UserScript==
// @name         virtual-background
// @namespace    https://github.com/vpalmisano/virtual-background
// @version      1.0.5
// @updateURL    https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/main/virtual-background.user.js
// @downloadURL  https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/main/virtual-background.user.js
// @description  Virtual Background javascript browser library
// @author       Vittorio Palmisano
// @match        https://*/*
// @exclude      https://vpalmisano.github.io/virtual-background/*
// @run-at       document-start
// @icon         https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/devel/media/logo.svg
// @resource     virtual-background.js https://unpkg.com/@vpalmisano/virtual-background@1.0.5/dist/virtual-background.js
// @resource     vision_wasm_internal.js https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js
// @resource     vision_wasm_internal.wasm https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm
// @resource     selfie_multiclass_256x256.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
// @grant        GM_getResourceText
// @grant        GM_addElement
// @grant        GM_getResourceURL
// ==/UserScript==
try {
    GM_addElement('script', {
        textContent: GM_getResourceText('virtual-background.js'),
        type: 'text/javascript'
    });
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async function (constraints) {
            console.log(`getUserMedia:`, JSON.stringify(constraints));
            const mediaStream = await nativeGetUserMedia(constraints);
            const track = mediaStream.getVideoTracks()[0];
            if (track) {
                if (VirtualBackground.options.wasmLoaderPath.startsWith('mediapipe')) {
                    VirtualBackground.options.wasmLoaderPath = GM_getResourceURL('vision_wasm_internal.js');
                    VirtualBackground.options.wasmBinaryPath = GM_getResourceURL('vision_wasm_internal.wasm');
                    VirtualBackground.options.modelPath = GM_getResourceURL('selfie_multiclass_256x256.tflite');
                }
                try {
                    const newTrack = await VirtualBackground.processVideoTrack(track);
                    mediaStream.removeTrack(track);
                    mediaStream.addTrack(newTrack);
                } catch (e) {
                    console.error('VirtualBackground error', e)
                }
            }
            return mediaStream;
        };
    }
} catch (e) {
    console.error('Error loading virtual-background', e);
}

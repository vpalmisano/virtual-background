// ==UserScript==
// @name         virtual-background
// @namespace    https://github.com/vpalmisano/virtual-background
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/main/virtual-background.user.js
// @downloadURL  https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/main/virtual-background.user.js
// @description  Virtual Background javascript browser library
// @author       Vittorio Palmisano
// @match        https://*/*
// @run-at       document-start
// @icon         https://raw.githubusercontent.com/vpalmisano/virtual-background/refs/heads/devel/media/logo.svg
// @resource     JS https://unpkg.com/@vpalmisano/virtual-background-js@1.0.0/dist/virtual-background.js
// @grant        GM_getResourceText
// ==/UserScript==
try {
    const element = document.createElement('script');
    element.innerText = GM_getResourceText('JS');
    element.id = 'virtualbackground';
    element.type = 'text/javascript';
    document.head.appendChild(element);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async function (constraints) {
            console.log(`getUserMedia:`, JSON.stringify(constraints));
            const mediaStream = await nativeGetUserMedia(constraints);
            const track = mediaStream.getVideoTracks()[0];
            if (track) {
                const newTrack = await VirtualBackground.processVideoTrack(track);
                mediaStream.removeTrack(track);
                mediaStream.addTrack(newTrack);
            }
            return mediaStream;
        };
    }
} catch (e) {
    console.error('Error loading virtual-background', e);
}

# Virtual Background

This project implements a virtual background effect for webcam video streams directly in the browser. It allows users to select their webcam, apply effects like blur, and change their background, similar to features found in popular video conferencing applications.

[Demo page](https://vpalmisano.github.io/virtual-background/)

## Features

*   Webcam video processing in real-time using mediapipe and WebGL shaders
*   Optimized video segmenteation with adjustable filter controls (contrast, brightness, gamma, blur).
*   [Userscript](https://github.com/vpalmisano/virtual-background/raw/refs/heads/main/virtual-background.user.js) file to use the library everywhere.

## Technologies Used

*   HTML5 (Video, Canvas) / JavaScript / TypeScript
*   [MediaPipe](https://ai.google.dev/edge/mediapipe) (for image segmentation)
*   WebGL (for performant video filtering)

## API
Apply a virtual background to a MediaStreamTrack:
```js
const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true});
const track = mediaStream.getVideoTracks()[0];

const newTrack = await VirtualBackground.processVideoTrack(track);
mediaStream.removeTrack(track);
mediaStream.addTrack(newTrack);

// Use the mediaStream object.
```

The `VirtualBackground.options` object exported into the page DOM allows to customize
the following options:

*   `contrast`: (Number) Adjusts the image contrast. Default `1.0`.
*   `brightness`: (Number) Adjusts the image brightness. Default `0`.
*   `gamma`: (Number) Adjusts the image gamma. Default `1.0`.
*   `blur`: (Number) Adjusts the blur intensity on the background. Default `0`.
*   `smoothing`: (Number) Factor for temporal smoothing of the segmentation mask. Default `0.75`.
*   `smoothstepMin`: (Number) Minimum threshold for the smoothstep function applied to the segmentation mask. Range `0.0` to `1.0`. Default `0.6`.
*   `smoothstepMax`: (Number) Maximum threshold for the smoothstep function applied to the segmentation mask. Range `0.0` to `1.0`. Default `0.9`.
*   `backgroundSource`: (String) URL of the image or video to use as the virtual background. Updated via file upload in the demo or using the `VirtualBackground.updateBackground()` method that triggers a file selector.

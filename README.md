# Virtual Background

This project implements a virtual background effect for webcam video streams directly in the browser. It allows users to select their webcam, apply effects like blur, and change their background, similar to features found in popular video conferencing applications.

## Features

*   Webcam video processing in real-time using mediapipe and WebGL shaders
*   Optimized video segmenteation with adjustable filter controls (contrast, brightness, gamma, blur).
*   [Userscript](https://github.com/vpalmisano/virtual-background/raw/refs/heads/main/virtual-background.user.js) file to use the library everywhere.

## Technologies Used

*   HTML5 (Video, Canvas) / JavaScript / TypeScript
*   [MediaPipe](https://ai.google.dev/edge/mediapipe) (for image segmentation)
*   WebGL (for performant video filtering)

## API
The `VirtualBackground.options` object exported into the page DOM allows to customize
the following options:

*   `contrast`: (Number) Adjusts the image contrast. Default `1.0`.
*   `brightness`: (Number) Adjusts the image brightness. Default `0`.
*   `gamma`: (Number) Adjusts the image gamma. Default `1.0`.
*   `blur`: (Number) Adjusts the blur intensity on the background. Default `0`.
*   `smoothing`: (Number) Factor for temporal smoothing of the segmentation mask. Default `0.75`.
*   `smoothstepMin`: (Number) Minimum threshold for the smoothstep function applied to the segmentation mask. Range `0.0` to `1.0`. Default `0.6`.
*   `smoothstepMax`: (Number) Maximum threshold for the smoothstep function applied to the segmentation mask. Range `0.0` to `1.0`. Default `0.9`.
*   `backgroundImageUrl`: (String) URL of the image to use as the virtual background. Updated via file upload in the demo or using the `VirtualBackground.updateBackground()` method.

import { writable } from 'svelte/store';

// App state
export const isAnalyzing = writable(false);
export const cameraDevices = writable([]);
export const selectedDeviceId = writable("");

// Mode source
// 'camera' = Live Camera, 'image' = Static Image Upload
export const videoSourceMode = writable('camera');
export const uploadedImage = writable(null);
export const isFrozen = writable(false);

// Mode selection for extracting light intensity
// 'band' = horizontal slice profile (10% of height)
// 'center' = middle horizontal line
// 'manual' = custom bounding box
export const roiMode = writable("band");

export const mirrorVideo = writable(false);
export const lockExposure = writable(false);
export const bandHeightPercent = writable(10); // 10% defaults

// Raw plotting data [number, number, ...] representing luminance per column
export const intensityData = writable([]);

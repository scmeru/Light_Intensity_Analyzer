import { writable } from 'svelte/store';

// App state
export const isAnalyzing = writable(false);
export const cameraDevices = writable([]);
export const selectedDeviceId = writable("");

// Mode source
// 'camera' = Live Camera, 'image' = Static Image Upload, 'simulation' = Physics Simulator
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

// Physics Simulation State
export const simType = writable('single'); // 'single', 'double', 'grating'
export const simWavelength = writable(650); // nm (visible spectrum ~400-700)
export const simSlitWidth = writable(0.1); // mm
export const simSlitDistance = writable(0.5); // mm (double slit / grating)
export const simSlitCount = writable(10); // Number of slits (grating)
export const simScreenDistance = writable(1000); // mm (1 meter)
export const simZoom = writable(1); // Zoom level for the chart

// Raw plotting data [number, number, ...] representing luminance per column
export const intensityData = writable([]);

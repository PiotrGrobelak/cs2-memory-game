// Device module barrel exports
export { useDeviceDetection } from "./useDeviceDetection";

// Re-export types (primary source: useDeviceDetection)
export type {
  DeviceType,
  DeviceOrientation,
  BreakpointSize,
} from "./useDeviceDetection";

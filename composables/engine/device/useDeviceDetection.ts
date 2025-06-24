import { ref, computed, onMounted, onUnmounted, readonly } from "vue";
import { UAParser } from "ua-parser-js";

// Types
export type DeviceType = "mobile" | "tablet" | "desktop";
export type DeviceOrientation = "portrait" | "landscape";
export type BreakpointSize = "sm" | "md" | "lg" | "xl";

interface DeviceCapabilities {
  isTouchDevice: boolean;
  hasHover: boolean;
  hasMouseSupport: boolean;
  prefersReducedMotion: boolean;
  pixelRatio: number;
  userAgent: string;
  os: UAParser.IOS;
  browser: UAParser.IBrowser;
}

export const useDeviceDetection = () => {
  const windowSize = ref({ width: 0, height: 0 });

  const uaParser = new UAParser();
  const uaResult = uaParser.getResult();

  const deviceType = computed<DeviceType>(() => {
    const { width } = windowSize.value;

    const deviceType = uaResult.device.type;
    const os = uaResult.os.name?.toLowerCase();

    if (deviceType === "mobile") return "mobile";
    if (deviceType === "tablet") return "tablet";

    if (os?.includes("android") || os?.includes("ios")) {
      if (!width) return "mobile"; // Default for mobile OS without dimensions
      return width <= 768 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
    }

    if (width) {
      if (width <= 480) return "mobile";
      if (width <= 768) return "tablet";
    }

    return "desktop";
  });

  const deviceOrientation = computed<DeviceOrientation>(() => {
    const { width, height } = windowSize.value;
    if (width === 0 || height === 0) return "landscape";
    return width >= height ? "landscape" : "portrait";
  });

  const isTouchDevice = computed(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }

    return Boolean(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        ["mobile", "tablet"].includes(uaResult.device.type || "")
    );
  });

  const breakpoint = computed<BreakpointSize>(() => {
    const width = windowSize.value.width;
    if (width <= 767) return "sm";
    if (width <= 1023) return "md";
    if (width <= 1279) return "lg";
    return "xl";
  });

  const deviceCapabilities = computed<DeviceCapabilities>(() => {
    const touch = isTouchDevice.value;

    return {
      isTouchDevice: touch,
      hasHover: !touch, // Touch devices typically don't have hover
      hasMouseSupport:
        !touch || (typeof window !== "undefined" && "onmouseenter" in window),
      prefersReducedMotion:
        (typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) ||
        false,
      pixelRatio:
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      os: uaResult.os || {},
      browser: uaResult.browser || {},
    };
  });

  const hasMouseSupport = computed(
    () => deviceCapabilities.value.hasMouseSupport
  );

  const updateWindowSize = () => {
    if (typeof window !== "undefined") {
      windowSize.value = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
  };

  onMounted(() => {
    updateWindowSize();
    window.addEventListener("resize", updateWindowSize);

    console.log("🔍 Device detection initialized:", {
      deviceType: deviceType.value,
      deviceOrientation: deviceOrientation.value,
      windowSize: windowSize.value,
      capabilities: deviceCapabilities.value,
    });
  });

  onUnmounted(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", updateWindowSize);
    }
  });

  return {
    deviceType: readonly(deviceType),
    deviceOrientation: readonly(deviceOrientation),
    windowSize: readonly(windowSize),
    deviceCapabilities: readonly(deviceCapabilities),
    breakpoint: readonly(breakpoint),
    isMobile: computed(() => ["mobile", "tablet"].includes(deviceType.value)),
    isTouchDevice: readonly(isTouchDevice),
    hasMouseSupport: readonly(hasMouseSupport),
    updateWindowSize,
  };
};

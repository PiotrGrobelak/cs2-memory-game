import { ref, computed, onMounted, onUnmounted, readonly } from "vue";

export type DeviceType = "mobile" | "tablet" | "desktop";

// Custom mobile detection implementation
const createMobileDetection = () => {
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) {
    return {
      any: false,
      phone: false,
      tablet: false,
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window;

  // Mobile phone detection
  const phonePatterns = [
    /android.*mobile/,
    /iphone/,
    /ipod/,
    /blackberry/,
    /windows phone/,
    /mobile/,
  ];

  const isPhone = phonePatterns.some((pattern) => pattern.test(userAgent));

  // Tablet detection
  const tabletPatterns = [/ipad/, /android(?!.*mobile)/, /tablet/, /kindle/];

  const isTablet = tabletPatterns.some((pattern) => pattern.test(userAgent));

  return {
    any: isPhone || isTablet || hasTouch,
    phone: isPhone,
    tablet: isTablet,
  };
};

export const useDeviceDetection = () => {
  const windowSize = ref({ width: 0, height: 0 });
  const mobileDetection = createMobileDetection();

  // Primary device detection using custom mobile detection
  const deviceType = computed<DeviceType>(() => {
    // Check for mobile first
    if (mobileDetection.phone) {
      return "mobile";
    }

    // Check for tablet
    if (mobileDetection.tablet) {
      return "tablet";
    }

    // For remaining devices, use screen size as fallback
    const width = windowSize.value.width;
    if (width > 0 && width <= 767) {
      return "mobile";
    } else if (width > 767 && width <= 1023) {
      return "tablet";
    }

    return "desktop";
  });

  // Device capabilities detection
  const deviceCapabilities = computed(() => {
    const isBrowser = typeof window !== "undefined";

    return {
      isTouchDevice: isBrowser
        ? mobileDetection.any || "ontouchstart" in window
        : false,
      hasHover: !mobileDetection.any,
      hasMouseSupport: isBrowser
        ? !mobileDetection.any || "onmouseenter" in window
        : true,
      prefersReducedMotion: isBrowser
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
      pixelRatio: isBrowser ? window.devicePixelRatio : 1,
    };
  });

  // Convenience computed refs for commonly used properties
  const isTouchDevice = computed(() => deviceCapabilities.value.isTouchDevice);
  const hasMouseSupport = computed(
    () => deviceCapabilities.value.hasMouseSupport
  );

  // Breakpoint detection
  const breakpoint = computed(() => {
    const width = windowSize.value.width;
    if (width <= 767) return "sm";
    if (width <= 1023) return "md";
    if (width <= 1279) return "lg";
    return "xl";
  });

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
      mobileDetection,
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
    windowSize: readonly(windowSize),
    deviceCapabilities: readonly(deviceCapabilities),
    breakpoint: readonly(breakpoint),
    isMobile: mobileDetection.any,
    isTouchDevice: readonly(isTouchDevice),
    hasMouseSupport: readonly(hasMouseSupport),
    updateWindowSize,
  };
};

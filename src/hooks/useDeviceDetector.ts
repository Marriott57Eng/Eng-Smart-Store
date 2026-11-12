import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type OrientationType = 'portrait' | 'landscape';
export type PerformanceMode = 'auto' | 'smooth' | 'high';

export interface DeviceInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: OrientationType;
  isLandscape: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
  isTouch: boolean;
  recommendedCols: number;
  isLowSpec: boolean;
  perfMode: PerformanceMode;
  setPerfMode: (mode: PerformanceMode) => void;
}

const checkIsLowSpec = (
  mode: PerformanceMode,
  isTouch: boolean,
  isMobile: boolean,
  isTablet: boolean,
  fpsDowngraded = false
): boolean => {
  if (mode === 'smooth') return true;
  if (mode === 'high') return false;
  if (fpsDowngraded) return true;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
  }

  if (typeof navigator === 'undefined') return false;

  // Check Data Saver or slow network hints
  const conn = (navigator as any).connection;
  if (conn && (conn.saveData === true || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
    return true;
  }

  const ua = navigator.userAgent || '';

  // Detect older iOS (iOS 15 or older) or older Android (Android 11 or older)
  const iosMatch = ua.match(/OS (\d+)_/i);
  if (iosMatch && parseInt(iosMatch[1], 10) <= 15) {
    return true;
  }
  const androidMatch = ua.match(/Android (\d+)/i);
  if (androidMatch && parseInt(androidMatch[1], 10) <= 11) {
    return true;
  }

  const cores = navigator.hardwareConcurrency || 4;
  // Note: Safari/iOS does not expose navigator.deviceMemory; default to 6 on modern iOS (>=16), 4 otherwise
  const isModernIOS = Boolean(iosMatch && parseInt(iosMatch[1], 10) >= 16);
  const mem = (navigator as any).deviceMemory || (isModernIOS ? 6 : 4);

  // Older or budget phones/tablets with <= 4 CPU cores or <= 4GB RAM -> low-spec mode (reduce CPU load)
  if (cores <= 4 || mem <= 4) {
    return true;
  }

  // Mid-range Android phones with <= 6 cores and < 6GB RAM
  if ((isMobile || isTablet || isTouch) && cores <= 6 && mem < 6 && !isModernIOS) {
    return true;
  }

  // Newer high-speed phones (e.g. modern iPhone iOS 16+ with 6+ cores, or flagship Android with 8 cores & 6-12GB+ RAM)
  // and modern tablets/desktops run with normal hardware-accelerated effects (isLowSpec = false)
  return false;
};

const getStoredPerfMode = (): PerformanceMode => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = localStorage.getItem('performance_mode') as PerformanceMode;
    if (stored === 'smooth' || stored === 'high' || stored === 'auto') return stored;
  } catch (_) {}
  return 'auto';
};

const calculateDeviceInfo = (currentPerfMode?: PerformanceMode, fpsDowngraded = false): Omit<DeviceInfo, 'setPerfMode'> => {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      orientation: 'portrait',
      isLandscape: false,
      isPortrait: true,
      width: 375,
      height: 667,
      isTouch: true,
      recommendedCols: 1,
      isLowSpec: true,
      perfMode: 'auto',
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const orientation: OrientationType = w >= h ? 'landscape' : 'portrait';
  const isLandscape = orientation === 'landscape';
  const isPortrait = orientation === 'portrait';
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  
  const ua = navigator.userAgent.toLowerCase();
  const isIpad = /ipad|macintosh/.test(ua) && Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua);
  const isTabletUA = isIpad || isAndroidTablet || /tablet|playbook|silk/.test(ua);

  // Shortest and longest screen dimensions to distinguish phone from tablet regardless of rotation
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);

  let deviceType: DeviceType = 'desktop';

  if (!isTouch && w >= 1024) {
    deviceType = 'desktop';
  } else if (isTabletUA || (isTouch && minDim >= 600 && maxDim >= 900)) {
    deviceType = 'tablet';
  } else if (minDim < 600 || /mobile|iphone|ipod|android.*mobile/.test(ua)) {
    deviceType = 'mobile';
  } else if (w < 1200) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }

  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';

  // Recommended grid columns for inventory items in portrait and landscape
  let recommendedCols = 1;
  if (isDesktop) {
    recommendedCols = w >= 1600 ? 4 : 3;
  } else if (isTablet) {
    recommendedCols = isLandscape ? 3 : 2;
  } else {
    // Mobile phones: 1 col in portrait, 2 cols in landscape for high-productivity viewing
    recommendedCols = isLandscape ? 2 : 1;
  }

  const mode = currentPerfMode || getStoredPerfMode();
  const isLowSpec = checkIsLowSpec(mode, Boolean(isTouch), isMobile, isTablet, fpsDowngraded);

  return {
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    isLandscape,
    isPortrait,
    width: w,
    height: h,
    isTouch: Boolean(isTouch),
    recommendedCols,
    isLowSpec,
    perfMode: mode,
  };
};

export const useDeviceDetector = (): DeviceInfo => {
  const [perfMode, setPerfModeState] = useState<PerformanceMode>(getStoredPerfMode);
  const [fpsDowngraded, setFpsDowngraded] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState(() => calculateDeviceInfo(perfMode, false));

  const setPerfMode = (mode: PerformanceMode) => {
    setPerfModeState(mode);
    if (mode !== 'auto') {
      setFpsDowngraded(false);
    }
    try {
      localStorage.setItem('performance_mode', mode);
    } catch (_) {}
    const next = calculateDeviceInfo(mode, mode === 'auto' ? fpsDowngraded : false);
    setDeviceInfo(next);

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-perf-mode', mode);
      document.documentElement.setAttribute('data-low-spec', String(next.isLowSpec));
    }
  };

  // Real-time adaptive frame-rate probe:
  // If a phone/device is initially classified as high-spec in 'auto' mode, measure actual frame pacing
  // over 45 frames (~750ms). If the CPU is throttled (e.g. Low Power Mode or older chip) and FPS < 42,
  // automatically switch to low-spec mode to keep scrolling and interactions 100% smooth.
  useEffect(() => {
    if (typeof window === 'undefined' || perfMode !== 'auto' || deviceInfo.isLowSpec || fpsDowngraded) {
      return;
    }

    let rafId: number;
    let frameCount = 0;
    let slowFrames = 0;
    let lastTime = performance.now();
    const TARGET_FRAMES = 45;

    const checkFrame = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      // Ignore tab background switches (delta > 300ms)
      if (delta > 0 && delta < 300) {
        frameCount++;
        // Frame took longer than ~28ms (< 35 FPS)
        if (delta > 28) {
          slowFrames++;
        }
      }

      if (frameCount < TARGET_FRAMES) {
        rafId = requestAnimationFrame(checkFrame);
      } else if (slowFrames >= 12) {
        // More than 25% of frames dropped below 35fps -> auto-enable CPU-saving low-spec mode
        setFpsDowngraded(true);
      }
    };

    const startTimeout = window.setTimeout(() => {
      lastTime = performance.now();
      rafId = requestAnimationFrame(checkFrame);
    }, 600);

    return () => {
      clearTimeout(startTimeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [perfMode, deviceInfo.isLowSpec, fpsDowngraded]);

  useEffect(() => {
    const handleResize = () => {
      const next = calculateDeviceInfo(perfMode, fpsDowngraded);
      setDeviceInfo(next);

      // Auto-tag HTML document element for high-performance CSS and typography rules
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-device', next.deviceType);
        document.documentElement.setAttribute('data-orientation', next.orientation);
        document.documentElement.setAttribute('data-touch', String(next.isTouch));
        document.documentElement.setAttribute('data-landscape', String(next.isLandscape));
        document.documentElement.setAttribute('data-low-spec', String(next.isLowSpec));
        document.documentElement.setAttribute('data-perf-mode', next.perfMode);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Also listen to modern screen.orientation if available
    if (typeof window !== 'undefined' && 'screen' in window && window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (typeof window !== 'undefined' && 'screen' in window && window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
      }
    };
  }, [perfMode, fpsDowngraded]);

  return {
    ...deviceInfo,
    setPerfMode,
  };
};


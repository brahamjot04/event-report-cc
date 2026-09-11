/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const PwaContext = createContext(null);

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://")
    );
  });
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  // 1. Detect iOS Safari
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) &&
      !window.MSStream &&
      !window.matchMedia("(display-mode: standalone)").matches &&
      !window.navigator.standalone;
    setIsIos(isIosDevice);
  }, []);

  // 2. Listen for beforeinstallprompt event (Desktop Chrome/Edge, Android)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 3. Online/Offline Network listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 4. Service Worker update detection
  useEffect(() => {
    const handleSwUpdate = (event) => {
      if (event.detail && event.detail.waitingWorker) {
        setWaitingWorker(event.detail.waitingWorker);
        setUpdateAvailable(true);
      }
    };

    window.addEventListener("pwa-update-available", handleSwUpdate);
    return () => window.removeEventListener("pwa-update-available", handleSwUpdate);
  }, []);

  // Prompt install trigger
  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
      return choiceResult.outcome;
    } else if (isIos) {
      setShowIosGuide(true);
      return "ios-guide";
    }
    return "unsupported";
  }, [deferredPrompt, isIos]);

  // Apply service worker update
  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }, [waitingWorker]);

  const value = useMemo(
    () => ({
      isInstallable: isInstallable || isIos,
      canNativePrompt: !!deferredPrompt,
      isInstalled,
      isIos,
      showIosGuide,
      setShowIosGuide,
      promptInstall,
      isOnline,
      updateAvailable,
      applyUpdate,
      dismissUpdate: () => setUpdateAvailable(false),
    }),
    [
      isInstallable,
      deferredPrompt,
      isInstalled,
      isIos,
      showIosGuide,
      promptInstall,
      isOnline,
      updateAvailable,
      applyUpdate,
    ]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
}

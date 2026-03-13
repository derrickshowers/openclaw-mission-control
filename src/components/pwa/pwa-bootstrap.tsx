"use client";

import { useEffect } from "react";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function PwaBootstrap() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    const syncStandaloneClass = () => {
      const isStandalone =
        mediaQuery.matches || (window.navigator as NavigatorWithStandalone).standalone === true;

      document.documentElement.classList.toggle("standalone-mode", isStandalone);
    };

    syncStandaloneClass();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncStandaloneClass);
    } else {
      mediaQuery.addListener(syncStandaloneClass);
    }

    if (
      process.env.NODE_ENV === "production" &&
      window.isSecureContext &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("Service worker registration failed", error);
      });
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", syncStandaloneClass);
      } else {
        mediaQuery.removeListener(syncStandaloneClass);
      }
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isDisposed = false;

    const configureNativeShell = async () => {
      await Promise.allSettled([
        StatusBar.show(),
        StatusBar.setStyle({ style: Style.Default }),
        StatusBar.setOverlaysWebView({ overlay: false }),
        Keyboard.setResizeMode({ mode: KeyboardResize.Native }),
        Keyboard.setAccessoryBarVisible({ isVisible: false }),
        SplashScreen.hide(),
      ]);
    };

    void configureNativeShell();

    let appUrlOpenHandle:
      | Awaited<ReturnType<typeof CapacitorApp.addListener>>
      | undefined;

    const attachListeners = async () => {
      const handle = await CapacitorApp.addListener(
        "appUrlOpen",
        (event: URLOpenListenerEvent) => {
          try {
            const url = new URL(event.url);
            const route = (
              url.protocol === "http:" || url.protocol === "https:"
                ? `${url.pathname}${url.search}${url.hash}`
                : `/${url.host}${url.pathname}${url.search}${url.hash}`
            ).replace(/\/{2,}/g, "/");

            if (route) {
              router.push(route);
            }
          } catch {
            router.push("/");
          }
        },
      );

      if (isDisposed) {
        await handle.remove();
        return;
      }

      appUrlOpenHandle = handle;
    };

    void attachListeners();

    return () => {
      isDisposed = true;
      void appUrlOpenHandle?.remove();
    };
  }, [router]);

  return null;
}

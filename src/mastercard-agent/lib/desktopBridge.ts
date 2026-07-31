/**
 * Tauri-ready desktop bridge. Every native-window concern (mode, always-on-
 * top, position/size, tray, fullscreen, opening a file/folder, OS
 * notifications) goes through this module -- no component may call a Tauri
 * API (or a browser equivalent) directly. In a Tauri build, each method body
 * is swapped for the matching `@tauri-apps/api` / custom-command call; in
 * the browser (Lovable preview, this repo's dev server) every method is a
 * safe mock that either no-ops or uses the closest browser equivalent.
 */
import type { DisplayMode, WindowPosition, WindowSize } from "../types";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

function devLog(action: string, payload?: unknown) {
  // eslint-disable-next-line no-console
  console.info(`[desktopBridge:mock] ${action}`, payload ?? "");
}

export const desktopBridge = {
  async setWindowMode(mode: DisplayMode): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): invoke("set_window_mode", { mode })
    }
    devLog("setWindowMode", mode);
  },

  async setAlwaysOnTop(enabled: boolean): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.setAlwaysOnTop(enabled)
    }
    devLog("setAlwaysOnTop", enabled);
  },

  async setWindowPosition(position: WindowPosition): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.setPosition(new LogicalPosition(position.x, position.y))
    }
    devLog("setWindowPosition", position);
  },

  async setWindowSize(size: WindowSize): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.setSize(new LogicalSize(size.width, size.height))
    }
    devLog("setWindowSize", size);
  },

  async minimizeToTray(): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.hide() + tray icon shows a "restore" menu item
    }
    devLog("minimizeToTray");
  },

  async restoreWindow(): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.show() + appWindow.setFocus()
    }
    devLog("restoreWindow");
  },

  async toggleFullscreen(): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): appWindow.setFullscreen(!(await appWindow.isFullscreen()))
      return;
    }
    // Browser-preview approximation of a native fullscreen toggle.
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      devLog("toggleFullscreen (fullscreen API unavailable in this preview)");
    }
  },

  async openLocalFile(path: string): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): invoke("open_local_file", { path }) -- backend validates
      // the path is inside an indexed root before shelling out to the OS opener.
    }
    devLog("openLocalFile", path);
  },

  async openFileLocation(path: string): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): invoke("open_file_location", { path })
    }
    devLog("openFileLocation", path);
  },

  async showDesktopNotification(message: string): Promise<void> {
    if (isTauri) {
      // TODO(Tauri): sendNotification({ title: "Mastercard Agent", body: message })
      return;
    }
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        new Notification("Mastercard Agent", { body: message });
        return;
      }
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission().catch(() => "denied");
        if (permission === "granted") {
          new Notification("Mastercard Agent", { body: message });
          return;
        }
      }
    }
    devLog("showDesktopNotification (falling back to in-app toast)", message);
  },
};

export type DesktopBridge = typeof desktopBridge;

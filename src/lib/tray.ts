import { invoke } from "@tauri-apps/api/core";
import type { Language } from "./messages";

export const supportsTray = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Read the native preference; the browser preview cannot hide its window. */
export async function getCloseToTray(): Promise<boolean> {
  return supportsTray() ? invoke<boolean>("get_close_to_tray") : false;
}

/** Persist the native close behavior before displaying it as saved. */
export async function setCloseToTray(enabled: boolean): Promise<void> {
  if (!supportsTray()) throw new Error("System tray is available in the desktop app only.");
  await invoke("set_close_to_tray", { enabled });
}

/** Keep the native menu in the current interface language. */
export async function setTrayLanguage(language: Language): Promise<void> {
  if (supportsTray()) await invoke("set_tray_language", { language });
}

/** Hide the window through the native recovery-safe tray path. */
export async function hideToTray(): Promise<void> {
  if (!supportsTray()) throw new Error("System tray is available in the desktop app only.");
  await invoke("hide_to_tray");
}

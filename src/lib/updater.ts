import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";

export const AUTO_UPDATE_KEY = "dark-control.auto-updates";
export const AUTO_CHECK_SESSION_KEY = "dark-control.update.auto-checked";

export const supportsUpdater = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let inFlightCheck: Promise<Update | null> | null = null;

export async function getAppVersion(): Promise<string> {
  if (!supportsUpdater()) return "0.4.0";
  try {
    return await getVersion();
  } catch {
    return "0.4.0";
  }
}

/** Coalesce simultaneous startup/settings checks into a single updater request. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!supportsUpdater()) return null;
  if (!inFlightCheck) {
    inFlightCheck = check({ timeout: 15_000 }).finally(() => {
      inFlightCheck = null;
    });
  }
  return inFlightCheck;
}

export type { Update };

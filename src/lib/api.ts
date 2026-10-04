import { invoke } from "@tauri-apps/api/core";
import type { DeviceSummary, LightingSettings, MacroEvent, PerformanceSettings, ProfileState, RawKeyBinding, SnapPair } from "./types";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK: ProfileState = {
  profile: 2,
  lighting: { effect: 8, brightness: 100, speed: 75, direction: 0, color: [148, 5, 57], multiColor: false },
  performance: { pollingRate: 1000, inputLatency: 2, debounce: 5, sleepTime: 10 },
  snapTapEnabled: false,
  snapTapPairs: [{ kind: 0, key1: 4, key2: 7 }],
  keyBindings: [],
  fnKeyBindings: [],
  macros: [],
};

export async function scanDevice(): Promise<DeviceSummary> {
  if (!isTauri()) return {
    connected: false,
    productName: "DPKB_BUSHIDO_87_ANSI",
    vendorId: 0x342d,
    productId: 0xe40f,
    firmware: "preview",
    layout: "ANSI",
    protocol: "CommonKeyboardSeries",
    profiles: 3,
    activeProfile: 2,
    capabilities: {
      lighting: true,
      customLighting: true,
      keybindings: true,
      fnLayer: true,
      snapTap: true,
      macros: true,
      performance: false,
      profiles: true,
      maxSnapTapPairs: 20,
      lightingEffects: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,19],
    },
  };
  return invoke("scan_device");
}

export async function readProfile(profile: number): Promise<ProfileState> {
  if (!isTauri()) return { ...structuredClone(MOCK), profile };
  return invoke("read_profile", { profile });
}

export async function switchProfile(profile: number): Promise<void> {
  if (isTauri()) await invoke("switch_profile", { profile });
}
export async function applyLighting(profile: number, settings: LightingSettings): Promise<void> {
  if (isTauri()) await invoke("apply_lighting", { profile, settings });
}
export async function applyPerformance(profile: number, settings: PerformanceSettings): Promise<void> {
  if (isTauri()) await invoke("apply_performance", { profile, settings });
}
export async function applySnapTap(profile: number, enabled: boolean, pairs: SnapPair[]): Promise<void> {
  if (isTauri()) await invoke("apply_snap_tap", { profile, enabled, pairs });
}
export async function applyKeyBinding(profile: number, layer: number, patch: RawKeyBinding): Promise<void> {
  if (isTauri()) await invoke("apply_key_binding", { profile, layer, patch });
}
export async function writeMacro(macroId: number, events: MacroEvent[]): Promise<void> {
  if (isTauri()) await invoke("write_macro", { macroId, events });
}

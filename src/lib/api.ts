import { invoke } from "@tauri-apps/api/core";
import type { DeviceSummary, LightingSettings, MacroEvent, PerformanceSettings, ProfileState, RawKeyBinding, SnapPair } from "./types";

import { DEVICE_REGISTRY, getDeviceMetadata, hasVerifiedDriver, previewDevice } from "../data/registry";
import { getDefaultProfile } from "../data/defaults";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** List connected native devices, or registry models in the browser preview. */
export async function listDevices(): Promise<DeviceSummary[]> {
  return isTauri() ? invoke("scan_devices") : DEVICE_REGISTRY.map(previewDevice);
}

function requirePreviewDevice(deviceId?: string): DeviceSummary {
  const model = deviceId !== undefined ? getDeviceMetadata(deviceId)
    : DEVICE_REGISTRY.find(hasVerifiedDriver);
  if (!model) throw new Error("Selected device is no longer connected");
  return previewDevice(model);
}

async function command<T>(name: string, payload: Record<string, unknown>, deviceId?: string): Promise<T | undefined> {
  if (isTauri()) return invoke<T>(name, { ...payload, deviceId });
  if (!requirePreviewDevice(deviceId).verified) {
    throw new Error("Device is unverified; HID commands are disabled");
  }
}

export async function scanDevice(deviceId?: string): Promise<DeviceSummary> {
  return isTauri() ? invoke("scan_device", { deviceId }) : requirePreviewDevice(deviceId);
}

export async function readProfile(profile: number, deviceId?: string): Promise<ProfileState> {
  const result = await command<ProfileState>("read_profile", { profile }, deviceId);
  return result ?? getDefaultProfile(requirePreviewDevice(deviceId).registryId!, profile);
}

export async function switchProfile(profile: number, deviceId?: string): Promise<void> {
  await command("switch_profile", { profile }, deviceId);
}
export async function applyLighting(profile: number, settings: LightingSettings, deviceId?: string): Promise<void> {
  await command("apply_lighting", { profile, settings }, deviceId);
}
export async function applyPerformance(profile: number, settings: PerformanceSettings, deviceId?: string): Promise<void> {
  await command("apply_performance", { profile, settings }, deviceId);
}
export async function applySnapTap(profile: number, enabled: boolean, pairs: SnapPair[], deviceId?: string): Promise<void> {
  await command("apply_snap_tap", { profile, enabled, pairs }, deviceId);
}
export async function applyKeyBinding(profile: number, layer: number, patch: RawKeyBinding, deviceId?: string): Promise<void> {
  await command("apply_key_binding", { profile, layer, patch }, deviceId);
}
export async function writeMacro(macroId: number, events: MacroEvent[], deviceId?: string): Promise<void> {
  await command("write_macro", { macroId, events }, deviceId);
}

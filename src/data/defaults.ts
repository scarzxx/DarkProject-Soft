import { getDeviceMetadata, getLayout } from "./registry";
import { keyHid } from "./keyboard";
import type { ProfileState } from "../lib/types";

/** Build an isolated preview profile from vendor defaults, never from hardware. */
export async function getDefaultProfile(deviceId: string, profile: number): Promise<ProfileState> {
  const { default: defaults } = await import("../../registry/defaults.json");
  const metadata = getDeviceMetadata(deviceId);
  const data = defaults[deviceId as keyof typeof defaults]?.profiles[profile];
  if (!metadata || !data || !Number.isInteger(profile) || profile < 0) {
    throw new Error("Invalid vendor default profile");
  }
  const slots = getLayout(metadata.styleName)?.slotMapping ?? {};
  return {
    profile,
    lighting: { ...data.lighting, color: [...data.lighting.color] as [number, number, number] },
    performance: { ...data.performance, debounce: "debounce" in data.performance ? data.performance.debounce : 0,
      sleepTime: "sleepTime" in data.performance ? data.performance.sleepTime : 0 },
    snapTapEnabled: data.snapTapEnabled,
    snapTapPairs: data.snapTapPairs.map((pair) => ({ kind: pair.kind, key1: keyHid(pair.key1), key2: keyHid(pair.key2) })),
    keyBindings: data.keyBindings.flatMap((binding) => {
      const slot = slots[binding.key];
      const code = keyHid(binding.target);
      return slot !== undefined && binding.kind === 1 && code > 0 ? [{ slot, kind: 1, code }] : [];
    }),
    fnKeyBindings: [],
    macros: [],
  };
}

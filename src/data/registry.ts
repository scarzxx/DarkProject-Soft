import devices from "../../registry/devices.json";
import layouts from "../../registry/layouts.json";
import protocols from "../../registry/protocols.json";
import type { DeviceCapabilities, DeviceSummary } from "../lib/types";

export interface DeviceMetadata {
  id: string;
  sourceId: string;
  modelName: string;
  productName: string;
  hardwareName: string;
  displayName: string;
  vendorId: number;
  productId: number;
  routerId: string;
  styleName: string;
  profiles: number;
  fnLayers: number;
  defaultProfile: number;
  verified: boolean;
  capabilities: DeviceCapabilities;
  connections: { vendorId: number; productId: number; transport: string }[];
  interfaces: { usagePage: number; usage: number; transport: string | null }[];
}

export interface LayoutKey {
  keyMapping: string;
  left: string;
  top: string;
  width: string;
  height: string;
  paddingBottom?: string;
}

export interface KeyboardLayout {
  styleName: string;
  width: string;
  height: string;
  canvasSource: string;
  mappingSource: string;
  slotMapping: Readonly<Partial<Record<string, number>>>;
  keys: LayoutKey[];
}

export const DEVICE_REGISTRY: readonly DeviceMetadata[] = devices;
export const LAYOUT_REGISTRY = new Map<string, KeyboardLayout>(
  layouts.map((layout) => [layout.styleName, layout]),
);
const DEVICE_BY_ID = new Map(DEVICE_REGISTRY.map((device) => [device.id, device]));
export const PROTOCOL_REGISTRY = new Map(protocols.map((protocol) => [protocol.routerId, protocol]));

/** Resolve technical device metadata by its vendor model identifier. */
export function getDeviceMetadata(id: string | null): DeviceMetadata | undefined {
  return id === null ? undefined : DEVICE_BY_ID.get(id);
}

/** Resolve exact vendor geometry; unknown styles have no invented fallback. */
export function getLayout(styleName: string | null): KeyboardLayout | undefined {
  return styleName === null ? undefined : LAYOUT_REGISTRY.get(styleName);
}

/** Expose only features with a verified, implemented protocol driver. */
export function availableCapabilities(device: DeviceMetadata): DeviceCapabilities {
  const available = hasVerifiedDriver(device);
  return {
    lighting: available && device.capabilities.lighting,
    customLighting: available && device.capabilities.customLighting,
    keybindings: available && device.capabilities.keybindings,
    fnLayer: available && device.capabilities.fnLayer,
    snapTap: available && device.capabilities.snapTap,
    macros: available && device.capabilities.macros,
    performance: available && device.capabilities.performance,
    profiles: available && device.capabilities.profiles,
    maxSnapTapPairs: available ? device.capabilities.maxSnapTapPairs : 0,
    lightingEffects: available ? device.capabilities.lightingEffects : [],
    tft: false, sync: false, actuation: false,
  };
}

/** Check both model verification and the driver supported by this build. */
export function hasVerifiedDriver(device: DeviceMetadata): boolean {
  return device.verified && device.routerId === "CommonKeyboardSeries"
    && PROTOCOL_REGISTRY.get(device.routerId)?.deviceIds.includes(device.id) === true;
}

/** Build a disconnected browser preview from the same metadata as native HID. */
export function previewDevice(device: DeviceMetadata): DeviceSummary {
  const verified = hasVerifiedDriver(device);
  return {
    id: device.id,
    registryId: device.id,
    known: true,
    verified,
    productName: device.productName,
    vendorId: device.vendorId,
    productId: device.productId,
    firmware: "preview",
    styleName: device.styleName,
    layout: device.styleName.endsWith("UK") || device.styleName.endsWith("ISO")
      ? "ISO" : "ANSI",
    protocol: device.routerId,
    connected: false,
    profiles: device.profiles,
    activeProfile: verified ? device.defaultProfile : 0,
    capabilities: availableCapabilities(device),
    advertisedCapabilities: device.capabilities,
  };
}

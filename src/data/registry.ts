import devices from "../../registry/devices.json";
import driverCapabilities from "../../registry/driver-capabilities.json";
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

export interface DriverFeatureSet {
  profileState: boolean;
  lighting: boolean;
  customLighting: boolean;
  keybindings: boolean;
  fnLayer: boolean;
  snapTap: boolean;
  macros: boolean;
  performance: boolean;
  profiles: boolean;
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
export const DRIVER_CAPABILITIES = new Map<string, DriverFeatureSet>(
  Object.entries(driverCapabilities),
);

/** Resolve technical device metadata by its vendor model identifier. */
export function getDeviceMetadata(id: string | null): DeviceMetadata | undefined {
  return id === null ? undefined : DEVICE_BY_ID.get(id);
}

/** Resolve exact vendor geometry; unknown styles have no invented fallback. */
export function getLayout(styleName: string | null): KeyboardLayout | undefined {
  return styleName === null ? undefined : LAYOUT_REGISTRY.get(styleName);
}

/** Check model verification plus a registered protocol and safe UI adapter. */
export function hasVerifiedDriver(device: DeviceMetadata): boolean {
  return device.verified
    && DRIVER_CAPABILITIES.has(device.routerId)
    && PROTOCOL_REGISTRY.get(device.routerId)?.deviceIds.includes(device.id) === true;
}

/** True only for families whose complete profile snapshot maps losslessly to ProfileState. */
export function supportsProfileState(device: DeviceMetadata): boolean {
  return hasVerifiedDriver(device)
    && DRIVER_CAPABILITIES.get(device.routerId)?.profileState === true;
}

/** Expose only vendor features that also have a safe app-level command adapter. */
export function availableCapabilities(device: DeviceMetadata): DeviceCapabilities {
  const available = hasVerifiedDriver(device);
  const driver = DRIVER_CAPABILITIES.get(device.routerId);
  const lighting = available && driver?.lighting === true && device.capabilities.lighting;
  const snapTap = available && driver?.snapTap === true && device.capabilities.snapTap;
  return {
    lighting,
    customLighting: available && driver?.customLighting === true && device.capabilities.customLighting,
    keybindings: available && driver?.keybindings === true && device.capabilities.keybindings,
    fnLayer: available && driver?.fnLayer === true && device.capabilities.fnLayer,
    snapTap,
    macros: available && driver?.macros === true && device.capabilities.macros,
    performance: available && driver?.performance === true && device.capabilities.performance,
    profiles: available && driver?.profiles === true && device.capabilities.profiles,
    maxSnapTapPairs: snapTap ? device.capabilities.maxSnapTapPairs : 0,
    lightingEffects: lighting ? device.capabilities.lightingEffects : [],
    // Separate media/sync/actuation APIs are intentionally not exposed yet.
    tft: false,
    sync: false,
    actuation: false,
  };
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
    activeProfile: supportsProfileState(device) ? device.defaultProfile : 0,
    capabilities: availableCapabilities(device),
    advertisedCapabilities: device.capabilities,
  };
}

export type Page = "device" | "lighting" | "keybinds" | "snaptap" | "macros" | "performance" | "profiles" | "settings";

export interface DeviceCapabilities {
  lighting: boolean;
  customLighting: boolean;
  keybindings: boolean;
  fnLayer: boolean;
  snapTap: boolean;
  macros: boolean;
  performance: boolean;
  profiles: boolean;
  maxSnapTapPairs: number;
  lightingEffects: number[];
  tft: boolean;
  sync: boolean;
  actuation: boolean;
}

export interface DeviceSummary {
  id: string;
  registryId: string | null;
  styleName: string | null;
  verified: boolean;
  known: boolean;
  connected: boolean;
  productName: string;
  serialNumber?: string | null;
  vendorId: number;
  productId: number;
  firmware: string;
  layout: "ANSI" | "ISO" | "Unknown";
  protocol: string;
  profiles: number;
  activeProfile: number;
  capabilities: DeviceCapabilities;
  advertisedCapabilities: DeviceCapabilities;
}

export interface LightingSettings {
  effect: number;
  brightness: number;
  speed: number;
  direction: number;
  color: [number, number, number];
  multiColor: boolean;
}

export interface PerformanceSettings {
  pollingRate: number;
  inputLatency: number;
  debounce: number;
  sleepTime: number;
}

export interface SnapPair {
  kind: number;
  key1: number;
  key2: number;
}

export interface SnapTapState {
  enabled: boolean;
  pairs: SnapPair[];
}

export interface FeatureState {
  lighting: LightingSettings | null;
  snapTap: SnapTapState | null;
}

export interface RawKeyBinding {
  slot: number;
  code: number;
  kind: number;
}

export interface MacroEvent {
  hid: number;
  delay: number;
  pressed: boolean;
}

export interface MacroDefinition {
  id: number;
  events: MacroEvent[];
}

export interface ProfileState {
  profile: number;
  lighting: LightingSettings;
  performance: PerformanceSettings;
  snapTapEnabled: boolean;
  snapTapPairs: SnapPair[];
  keyBindings: RawKeyBinding[];
  fnKeyBindings: RawKeyBinding[];
  macros: MacroDefinition[];
}

# Architecture

## Stack

```text
Tauri 2
├─ React + TypeScript UI
└─ Rust backend
   ├─ hidapi
   ├─ protocol layer
   ├─ device registry
   └─ profile import/export
```

## Backend layout

```text
src-tauri/src/
├─ commands.rs
├─ device/
│  ├─ discovery.rs
│  ├─ capabilities.rs
│  └─ registry.rs
├─ protocol/
│  └─ common_keyboard.rs
├─ features/
│  ├─ lighting.rs
│  ├─ keymap.rs
│  ├─ macros.rs
│  ├─ snaptap.rs
│  ├─ performance.rs
│  └─ profiles.rs
└─ models/
```

`CommonKeyboardProtocol` owns HID packet encoding/decoding. UI code never talks to HID directly.

## Frontend layout

```text
src/
├─ pages/
│  ├─ Device
│  ├─ Lighting
│  ├─ Keybindings
│  ├─ SnapTap
│  ├─ Macros
│  ├─ Performance
│  ├─ Profiles
│  └─ Settings
├─ components/
│  ├─ Keyboard
│  ├─ ColorPicker
│  ├─ EffectGrid
│  ├─ Slider
│  └─ DeviceCard
└─ stores/
```

## Capability model

Every device declares capabilities instead of hard-coding UI per model.

```rust
pub struct DeviceCapabilities {
    pub lighting: bool,
    pub per_key_rgb: bool,
    pub key_remap: bool,
    pub fn_layer: bool,
    pub snap_tap: bool,
    pub macros: bool,
    pub polling_rate: bool,
    pub input_latency: bool,
    pub debounce: bool,
    pub sleep_timer: bool,
    pub profiles: u8,
}
```

The UI hides unsupported controls automatically.

## Safety rules

1. Read support first; writes are enabled feature-by-feature.
2. Keep a copy of the current profile before every destructive write.
3. Validate VID/PID + device family before sending commands.
4. Firmware/bootloader operations stay disabled until separately verified.
5. `.dp` import is parsed and validated before any HID write.

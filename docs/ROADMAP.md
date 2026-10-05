# Roadmap

## 0.1 — Read-only foundation

- [ ] Tauri 2 + React + TypeScript project
- [ ] Rust `hidapi` device discovery
- [ ] detect Bushido `342D:E40F`
- [ ] `CommonKeyboardSeries` transport
- [ ] read current profile
- [ ] read all 3 profiles
- [ ] read lighting
- [ ] read base + FN keymaps
- [ ] read Snap Tap
- [ ] read macros
- [ ] read polling/latency/debounce/sleep
- [ ] render everything in the approved UI

## 0.2 — Safe writes

- [ ] profile switch
- [ ] Solid RGB
- [ ] all verified lighting effects
- [ ] brightness / speed / direction
- [ ] polling / latency / debounce / sleep
- [ ] automatic backup before writes

## 0.3 — Advanced editing

- [ ] key remapping
- [ ] FN layer editor
- [ ] Snap Tap editor
- [ ] macro editor
- [ ] custom / per-key RGB
- [ ] live keyboard preview

## 0.4 — Vendor layouts and multi-device architecture

- [x] 45-model device registry extracted from vendor technical metadata
- [x] 17 exact percentage/keyMapping layout registries
- [x] Exact canvas dimensions, including inherited vendor stylesheet defaults
- [x] Dynamic StyleName renderer and capability-based navigation
- [x] Selected-device command routing and identity verification
- [x] Common driver split with preserved Bushido HID codec
- [x] Seven family codecs with model-based selection and verification gates
- [x] Mock HID transport and 1,059 external vendor golden vectors
- [x] Regression tests for slots, layouts, identity and command routing
- [ ] Physical Bushido regression test after this refactor

## Next — Hardware verification and remaining editors

- [ ] Verify additional Common models separately, including ISO/UA/wireless
- [ ] Hardware verification and remaining unsupported Dpone, Witmod, TFT, SparkLink and HFD operations
- [ ] Full custom/per-key RGB editor
- [ ] Profile cloning and local names
- [ ] Restore last known-good configuration
- [ ] Community diagnostic export for unknown devices

## Later

- [ ] auto-update for Dark Control
- [ ] optional themes
- [ ] Linux support where HID permissions allow it
- [ ] macOS investigation

## Explicitly postponed

Firmware flashing and bootloader writes are not part of the early releases. They will only be considered after a reliable recovery procedure exists.

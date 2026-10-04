# Dark Control

Modern desktop configurator for supported **Dark Project** keyboards.

> Independent community project. Not affiliated with or endorsed by Dark Project.

## Stack

**Tauri 2 + Rust + React + TypeScript + hidapi**

## Implemented

- native Bushido HID discovery/readback
- 3 hardware profiles
- verified RGB effects, color, brightness, speed and direction
- polling rate, input latency, debounce and sleep timer
- Base/FN key remapping primitives
- Snap Tap (up to 20 pairs)
- keyboard macro event writer/editor
- `.dp` import/export editor
- interactive Bushido 87 ANSI keyboard UI
- browser preview mode when Tauri/HID is unavailable

## Bushido

`DPKB_BUSHIDO_87_ANSI` · VID `342D` · PID `E40F` · Feature Report `7` · `CommonKeyboardSeries`

## Run

```bash
npm install
npm run tauri:dev
```

Build installer/app bundle:

```bash
npm run tauri:build
```

Windows CI checks the frontend and Rust backend on every push.

## Safety

Firmware flashing / bootloader commands are intentionally **not implemented**. Hardware writes are limited to configuration operations derived from observed device traffic and exported profiles. Test new device models before enabling writes.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [UI design](docs/DESIGN.md)
- [Protocol](docs/PROTOCOL.md)
- [`.dp` format](docs/PROFILE_FORMAT.md)
- [Devices](docs/DEVICES.md)
- [Research](docs/RESEARCH.md)
- [Roadmap](docs/ROADMAP.md)

# Dark Control

Modern desktop configurator for supported **Dark Project** keyboards.

> Independent community project. Not affiliated with or endorsed by Dark Project.

## Stack

- **Tauri 2** — desktop shell
- **Rust** — HID/device/protocol backend
- **React + TypeScript** — UI
- **hidapi** — native HID communication

## Goal

Build a fast native configurator with a polished UI for:

- RGB effects and per-key lighting
- Key remapping + FN layer
- Snap Tap
- Macros
- Polling rate, latency, debounce and sleep settings
- Hardware profiles
- `.dp` profile import/export
- Multiple Dark Project keyboard models through a capability-based device layer

## Current research target

**DPKB_BUSHIDO_87_ANSI / ALU87B Bushido**

- VID: `0x342D`
- PID: `0xE40F`
- HID Feature Report ID: `7`
- Protocol family: `CommonKeyboardSeries`
- Hardware profiles: `3`

The protocol notes are based on observed device traffic, exported `.dp` profiles and behavior of the vendor web configurator. We do **not** redistribute vendor source code or firmware.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [UI design](docs/DESIGN.md)
- [Protocol notes](docs/PROTOCOL.md)
- [`.dp` profile format](docs/PROFILE_FORMAT.md)
- [Devices](docs/DEVICES.md)
- [Roadmap](docs/ROADMAP.md)

## Status

Early development / protocol implementation.

First milestone: connect to Bushido, read all three profiles and display the current configuration in the desktop UI before enabling writes.

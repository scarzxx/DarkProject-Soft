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

Interface translation checks (Node.js 22.18 or newer):

```bash
npm test
```

## Build a Windows EXE

Install these tools once:

- Node.js 22 with npm.
- Rust using rustup, with the `x86_64-pc-windows-msvc` toolchain/target.
- Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK.

See the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/).
After installing the tools, reopen your terminal or Explorer so PATH is updated.

Double-click `build-exe.cmd`, or run it from PowerShell:

```powershell
.\build-exe.cmd
```

The script installs frontend dependencies, builds the frontend and Rust application
in release mode, and copies the Windows x64 executable to `output\Dark Control.exe`.
The first build requires internet access and can take several minutes. The window
stays open to show the result or any error. For automation, use
`build-exe.cmd --no-pause`; failures return exit code 1.

The executable requires the Microsoft Edge WebView2 Runtime on the computer where
it runs. To create an installer instead, use `npm run tauri:build`.

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

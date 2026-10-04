# Dark Control

Modern desktop configurator for supported **Dark Project** keyboards. Version **0.4.0**.

> Independent community project. Not affiliated with or endorsed by Dark Project.

## Stack

**Tauri 2 + Rust + React + TypeScript + hidapi**

## Implemented

- shared device registry: 45 vendor models, seven protocol families
- 17 vendor layouts rendered dynamically by `StyleName`, including ANSI/ISO
- native device selection with model verification before every HID operation
- unchanged Bushido ANSI/Common HID driver and three hardware profiles
- seven protocol-family codecs, injected HID transport and vendor golden byte vectors
- verified RGB effects, color, brightness, speed and direction
- Base/FN key remapping primitives
- Snap Tap (up to 20 pairs)
- keyboard macro event writer/editor
- `.dp` import/export editor
- capability-based pages; unverified models expose layout previews only
- browser preview mode when Tauri/HID is unavailable
- searchable keyboard picker with layout and verification information
- all four normalized vendor JSON tables imported from the supplied data ZIP

Rebuild application metadata from the preserved generated tables:

```bash
npm run data:import
```

Vendor defaults supply browser preview profiles only; native reads use HID.

## Bushido

`DPKB_BUSHIDO_87_ANSI` · VID `342D` · PID `E40F` · Feature Report `7` · `CommonKeyboardSeries`

Bushido ANSI is the only verified model. Shared VID/PID alone never enables its
driver for other keyboards. TFT, synchronization and actuation remain unavailable
even when advertised by vendor metadata. Performance primitives remain in the
Common driver, but the vendor flag is false and the UI hides that page.

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

Translation, registry, layout and command-routing tests (Node.js 22.18 or newer):

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
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

Firmware flashing, bootloader and factory reset commands are intentionally **not implemented**.
The six additional family codecs remain hardware **unverified**, with uncertain
operations explicitly unsupported. See [protocol coverage, limits and golden tests](docs/PROTOCOLS.md).
Test new models physically before enabling their production transport.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [UI design](docs/DESIGN.md)
- [Protocol](docs/PROTOCOL.md)
- [`.dp` format](docs/PROFILE_FORMAT.md)
- [Devices](docs/DEVICES.md)
- [Registry extraction and provenance](registry/README.md)
- [Research](docs/RESEARCH.md)
- [Roadmap](docs/ROADMAP.md)

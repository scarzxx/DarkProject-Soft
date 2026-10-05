# Dark Control

Modern desktop configurator for supported **Dark Project** keyboards. Version **0.4.0**.

> Independent community project. Not affiliated with or endorsed by Dark Project.

## Stack

**Tauri 2 + Rust + React + TypeScript + hidapi**

## Implemented

- shared device registry: 45 vendor models, seven protocol families
- 17 vendor layouts rendered dynamically by `StyleName`, including ANSI/ISO
- native device selection with exact VID/PID, model identity and HID interface checks
- unchanged Bushido ANSI/Common HID driver and three hardware profiles
- seven protocol-family codecs, injected HID transport and vendor golden byte vectors
- family-capability-gated RGB effects, color, brightness, speed and direction
- Base/FN key remapping adapters where the family has a lossless editor mapping
- Snap Tap where exposed by the family adapter
- keyboard macro event writer/editor where complete-table semantics are handled safely
- `.dp` import/export editor
- all 45 known registry models are supported; individual pages remain family-capability specific
- browser preview mode when Tauri/HID is unavailable
- searchable keyboard picker with layout and support information
- all four normalized vendor JSON tables imported from the supplied data ZIP
- optional close to tray, immediate hide button and localized open/exit menu
- signed in-app updater with automatic/manual checks in Settings for release builds

In Settings, choose language and appearance, configure **Close to tray**, and manage
updates. Automatic update checks default to on and stay silent when no update is
available. Release builds verify the update signature before installation.

Rebuild application metadata from the preserved generated tables:

```bash
npm run data:import
```

Vendor defaults supply browser preview profiles only; native reads use HID.

## Bushido

`DPKB_BUSHIDO_87_ANSI` · VID `342D` · PID `E40F` · Feature Report `7` · `CommonKeyboardSeries`

Bushido ANSI is the hardware-tested Common reference model. Shared VID/PID alone
never enables a driver for the wrong keyboard. Other known models are still
supported from the vendor-derived protocol registry, while operations that cannot
be represented losslessly by the current app adapter stay hidden.

## Run

```bash
npm install
npm run tauri:dev
```

Build installer/app bundle:

```bash
npm run tauri:build
```

Windows CI runs frontend and Rust checks on pull requests. A successful push to
`main` additionally uploads a `Dark-Control-Windows-x64` workflow artifact containing
the portable EXE, MSI installer and NSIS installer.

Translation, registry, layout, updater and command-routing tests:

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

## Releases and updates

Release versions are synchronized with:

```powershell
npm run release:version -- 0.4.1
npm install
```

Push the matching `v0.4.1` tag to run the signed release workflow. The workflow
creates MSI/NSIS bundles, updater signatures and `latest.json`, then publishes the
GitHub Release. One-time signing-key setup and the private-repository limitation are
documented in [docs/UPDATES.md](docs/UPDATES.md).

## Safety

Firmware flashing, bootloader and factory reset commands are intentionally **not implemented**.
Most non-Bushido hardware has not been physically tested by this project, so the app
still rejects unknown/ambiguous devices and hides operations without a safe family
adapter. Hardware-tested status is confidence metadata, not the runtime support gate.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [UI design](docs/DESIGN.md)
- [Protocol](docs/PROTOCOL.md)
- [`.dp` format](docs/PROFILE_FORMAT.md)
- [Devices](docs/DEVICES.md)
- [Updates and releases](docs/UPDATES.md)
- [Registry extraction and provenance](registry/README.md)
- [Research](docs/RESEARCH.md)
- [Roadmap](docs/ROADMAP.md)

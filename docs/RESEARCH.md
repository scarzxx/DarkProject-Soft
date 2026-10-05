# Research notes

## Captures used

Research was performed from a real **DPKB_BUSHIDO_87_ANSI** device using:

- WebHID traffic capture
- vendor application log
- exported `Hardware Profile3.dp`
- browser HAR containing the public web configurator assets

Raw vendor bundles, firmware and large captures are intentionally **not committed**. This repository keeps only interoperability notes and our own implementation.

## Hardware facts observed

```text
Product      DPKB_BUSHIDO_87_ANSI
VID:PID      342D:E40F
Family       CommonKeyboardSeries
Layout       US / ANSI
Feature ID   7
Firmware     v27 observed
```

The vendor log reported firmware v27 with release date `2025-04-07` and default debounce `5 ms`.

## Exported profile facts

The `.dp` export is JSON, not an encrypted binary format. The captured profile exposed:

- 3 hardware profiles
- base keymap + FN overrides
- lighting settings and custom per-key presets
- performance settings
- Snap Tap pairs
- macro container

Captured active Solid color was RGB `(148, 5, 57)` / `#940539`, matching the HID profile bytes identified during traffic analysis.

## Confidence labels

- **Verified** — observed on the physical Bushido capture and/or round-tripped through the vendor configurator.
- **Derived** — directly inferred from consistent packet encoding/decoding behavior.
- **Candidate** — same router/protocol family appears in the vendor device table, but no physical hardware test yet.

## Legal / project boundary

Dark Control is an independent interoperability project. Do not copy proprietary vendor source into this repository. Protocol implementation must be independently written from documented behavior and observed data.

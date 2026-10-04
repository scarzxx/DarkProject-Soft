# Devices

## Verified hardware

### ALU87B Bushido — ANSI

```text
Product name   DPKB_BUSHIDO_87_ANSI
VID            0x342D
PID            0xE40F
Layout         ANSI / US
Protocol       CommonKeyboardSeries
Feature report 7
Profiles       3
Firmware seen  v27
```

Research capture confirmed successful HID connection, profile reads and vendor profile export for this device.

## Same protocol family — candidates

The vendor configurator routes multiple 87-key models through `CommonKeyboardSeries`. They are **candidates**, not automatically marked supported until tested on real hardware.

- Violet 87 — ANSI / ISO / UA variants
- Midnight 87 — ANSI / ISO / UA variants
- Daylight 87 — ANSI / ISO / UA variants
- Onionite 87 — wired/wireless variants
- Bushido 87 — ANSI / ISO / UA variants
- Celestial 87 — ANSI / ISO / UA variants
- Delta 87 — ANSI variants
- Fuji 87 — ANSI / ISO / UA / FR variants

## Support policy

A device becomes `verified` only after:

1. detection by VID/PID + product information;
2. safe full-profile read;
3. RGB read/write test;
4. keymap read/write test;
5. Snap Tap test when advertised;
6. profile switching test;
7. restore/export test.

Layout data is device-specific even when the protocol is shared, so ANSI/ISO variants must be validated separately.

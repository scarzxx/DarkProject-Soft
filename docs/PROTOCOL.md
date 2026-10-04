# CommonKeyboardSeries protocol notes

Reverse-engineering notes for the Dark Project `CommonKeyboardSeries` family. These are interoperability notes derived from device traffic, exported profiles and observed vendor configurator behavior. No vendor source or firmware is redistributed here.

## Transport

Bushido uses HID Feature Reports.

```text
VID              0x342D
PID              0xE40F
Feature Report   7
Family           CommonKeyboardSeries
Profiles         3
Key buffer       96 positions
```

Typical exchange:

```text
sendFeatureReport(7, request)
wait
receiveFeatureReport(7)
```

Responses include the report ID as the first byte, so read offsets are generally one byte higher than write-buffer offsets.

## Command map

| Command | Direction | Purpose |
|---:|---|---|
| `0x01` | write | switch profile (`profile + 1`); `0xFF` is used by vendor reset flow |
| `0x02` | write | profile data / lighting / performance |
| `0x03` | write | key bindings |
| `0x04` | write | macro repeat/type metadata |
| `0x05` | write | macro event data |
| `0x09` | write | Snap Tap |
| `0x0A` | write | custom/per-key RGB data |
| `0x0B` | write | sleep + debounce |
| `0x30` | write | enter bootloader — **do not implement yet** |
| `0x32` | write | firmware chunk — **do not implement yet** |
| `0x81` | read | current profile |
| `0x82` | read | profile data / lighting / performance |
| `0x83` | read | key bindings |
| `0x84` | read | macro repeat/type metadata |
| `0x85` | read | macro data |
| `0x88` | read | device/firmware version |
| `0x89` | read | Snap Tap |
| `0x8A` | read | custom/per-key RGB data |
| `0x8B` | read | sleep / debounce / battery / wireless version |

## Lighting

Lighting writes start from the current profile buffer, then modify selected fields and send command `0x02`.

### Main offsets

| Write offset | Meaning |
|---:|---|
| `0` | `0x02` |
| `8` | HID effect ID |
| `9 + effect` | brightness step (`0..4`) |
| `23 + effect` | speed/rate step |
| `37 + effect` | multicolor (`8` or `0`) |
| `51` | direction for Wave-family direction control |
| `52` | custom-lighting preset index (`1..5`, `0` otherwise) |
| `58 + n` | red channel |
| `66 + n` | green channel |
| `74 + n` | blue channel |
| `83` | Spiral Wave direction |
| `85` | debounce value preserved in profile buffer |

Conversions currently observed:

```text
brightness_write = ceil(4 * percent / 100)
brightness_read  = 25 * stored

rate_write = round(5 - 4 * percent / 100)
rate_read  = 25 * (5 - stored)
```

### Effect mapping

| Profile effect | Name | HID effect |
|---:|---|---:|
| 0 | Wave | 0 |
| 1 | Spiral Wave | 6 |
| 2 | Random | 2 |
| 3 | Star | 7 |
| 4 | Footprint | 4 |
| 5 | River | 8 |
| 6 | Color Cycle | 1 |
| 7 | Breathing | 3 |
| 8 | Solid | 5 |
| 9 | Ripples | 9 |
| 10 | Trigger | 10 |
| 11 | Color Discharge | 11 |
| 12 | Sine Wave | 12 |
| 13 | Rain | 13 |
| 19 | Custom | 14 |

Bushido's exported profile currently exposes additional effect definitions up to ID 32, but the verified `CommonKeyboardSeries` capability list for this device family exposes the table above. Treat the rest as unverified until tested on hardware.

### Direction

Wave mapping:

```text
UI 0 right -> HID 0
UI 1 up    -> HID 3
UI 2 left  -> HID 1
UI 3 down  -> HID 2
```

Spiral Wave uses a separate direction byte at offset `83`.

## Custom / per-key RGB

Command `0x0A` is used for custom lighting.

```text
byte 0 = 0x0A
byte 1 = profile + 1
byte 2 = custom preset + 1
byte 3 = chunk + 1
```

The device uses 96-key color planes. Red, green and blue data are stored as separate planes and transferred in chunks. The exported `.dp` structure contains five custom presets (`Cust1` ... `Cust5`).

## Key bindings

Command `0x03`:

```text
byte 0 = 0x03
byte 1 = profile + 1
byte 2 = layer
         1 = base
         2 = FN
```

The family uses a 96-position matrix. One region contains HID/function codes and a second region contains function types.

Observed type values:

| Type | Meaning |
|---:|---|
| 0 | disabled |
| 1 | normal keyboard key |
| 3 | media / Windows shortcut |
| 5 | macro |
| 8 | profile switch |
| 9 | mouse function |
| `224+` | modifier shortcut bitmask |

## Snap Tap

Write command `0x09`:

```text
byte 0 = 0x09
byte 1 = profile + 1
byte 2 = enabled ? 1 : 0

pair N:
  byte 7 + 3*N = type
  byte 8 + 3*N = key 1 HID
  byte 9 + 3*N = key 2 HID
```

Read command `0x89` returns status and pairs. The device metadata indicates up to 20 Snap Tap groups for this family.

## Macros

### Assignment metadata

Command `0x04` stores macro repeat/type metadata per base/FN layer.

### Macro content

Command `0x05`:

```text
byte 0 = 0x05
byte 1 = macro ID
```

Events are encoded in 3-byte records containing delay/up-down state and HID code. Current implementation should preserve the vendor-compatible representation before adding higher-level editing features.

## Performance

Polling rate is stored in the profile buffer.

Verified mapping:

```text
index 1 = 125 Hz
index 2 = 250 Hz
index 3 = 500 Hz
index 4 = 1000 Hz
```

Input latency values observed by the configurator:

```text
0, 2, 8, 12
```

The exported Bushido profile used during research contained:

```text
PollingRateValue = 125
InputLatencyValue = 2
DebounceTime = 5
SleepTime = 10
```

## Sleep / debounce

Write command `0x0B`:

```text
byte 0 = 0x0B
byte 1 = sleep time
byte 2 = debounce time
```

Read command `0x8B` response:

```text
byte 2 = sleep time
byte 3 = debounce time
byte 4 = battery value
byte 5 = wireless/module version
```

## Device events

A secondary HID input interface reports live state changes. Observed payloads include:

```text
0xF1 -> profile changed
0xF0 -> Snap Tap status changed
```

## Firmware

Firmware update behavior is intentionally out of scope for the first releases. Bootloader and firmware-write commands must remain unreachable from normal application code until independently tested with a recovery path.

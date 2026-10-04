# `.dp` profile format

Dark Project hardware profile exports observed during Bushido testing are plain JSON.

## Envelope

```json
{
  "filename": "Profile",
  "SN": "0x342D0xE40F012",
  "value": {
    "verify": "Darkproject",
    "data": {
      "profile": {},
      "macro": [],
      "version": "1.0.1.0",
      "SN": "0x342D0xE40F012"
    }
  }
}
```

## Profile object

Important fields:

```text
profileName
profileid
BindingProfileIndex
BindingId
CreateDate
FnKeyboardKeys
fnModeMatrix
fnModeIndex
LightingIndex
Lighting[]
Performance
SnapTap
Keybinding[]
```

## Lighting entry

```text
value
name
BrightnessValue
RateValue
AngleValue
CustomColor
KeyMappingColor
CustomIndex
MultiColor
ColorNumberSetting
ColorPickerSetting
BrightnessSetting
RateSetting
```

The captured Bushido export contains lighting definitions `0..32`. `Custom` is ID `19`, `LedOff` is ID `20` and custom lighting contains five named slots (`Cust1` ... `Cust5`).

## Performance

Captured example:

```json
{
  "PollingRateValue": 125,
  "InputLatencyValue": 2,
  "DebounceTime": 5,
  "SleepTime": 10
}
```

## Snap Tap

```json
{
  "flag": 0,
  "snapTapIndex": 0,
  "snapTapShortcut": "ShiftRight",
  "SnapTapData": [
    {
      "value": 0,
      "Key1": "KeyA",
      "Key2": "KeyD",
      "type": 0
    }
  ]
}
```

## Import rules for Dark Control

1. Parse as JSON; never execute content.
2. Require `value.verify == "Darkproject"` for vendor imports.
3. Validate profile count, key names, RGB ranges and numeric limits.
4. Convert imported data into Dark Control's internal model before HID writes.
5. Create a device backup before applying an imported profile.
6. Preserve unknown fields on round-trip export when possible.

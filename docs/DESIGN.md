# UI Design

The generated DARK CONTROL mockup is the **1:1 visual target** for the first desktop build.

## Direction

- Dark graphite background
- Subtle glass/card surfaces
- Purple accent (`#7C3CFF` family)
- Thin borders, soft shadows, restrained glow
- Dense desktop layout without looking cluttered
- Keyboard visualization is the visual center of the app

## Main shell

```text
┌ Sidebar ─────────┬ Top device/profile bar ─────────────────────┐
│ Device           │ Device selector • VID/PID • FW • profile    │
│ Lighting         ├───────────────────────────────────────────────┤
│ Keybindings      │                                               │
│ Snap Tap         │           Interactive keyboard                │
│ Macros           │                                               │
│ Performance      ├───────────────────────┬───────────────────────┤
│ Profiles         │ Lighting / effects    │ Performance            │
│ Settings         ├──────────┬────────────┼──────────┬────────────┤
│                  │ Keybinds │ Snap Tap   │ Macros   │ Profiles   │
└──────────────────┴──────────┴────────────┴──────────┴────────────┘
```

## Pages

### Device
- connection status
- model + layout
- VID/PID
- firmware version
- protocol family
- refresh/reconnect

### Lighting
- interactive RGB keyboard preview
- effect selector/grid
- color picker + HEX/RGB input
- brightness
- speed
- direction when supported
- multi-color controls
- custom/per-key presets

### Keybindings
- click a key on the keyboard
- Base / FN layer toggle
- key, media, Windows shortcut, mouse, profile switch, macro, disabled
- reset selected key / layer

### Snap Tap
- enable/disable
- visual key-pair picker
- multiple pairs when supported
- conflict validation

### Macros
- macro list
- event timeline
- key down/up
- delays
- repeat mode/count
- assign directly to selected key

### Performance
- polling rate
- input latency
- debounce
- sleep timer

### Profiles
- Profile 1 / 2 / 3
- rename locally
- clone
- import/export `.dp`
- backup before write

## Interaction rules

- Changes are previewed in UI immediately.
- Device writes show a small non-blocking status indicator.
- Dangerous actions require explicit confirmation.
- Unsupported settings are hidden, not disabled clutter.
- Keyboard keys display live selection, RGB color, remap state and Snap Tap membership.

## Responsive target

Desktop-first. Primary reference size: **1536×1024**. Minimum practical window: approximately **1280×800**.

The UI should match the approved mockup before adding visual deviations or alternative themes.

# Architecture: v0.4

React uses the same bundled device metadata as the Rust backend. Registry entries
describe model identity, connection VID/PID, hardware/product names, vendor router,
layout StyleName, profile count and advertised capabilities.

## Repository layout

- registry/devices.json: 45 models, one verified.
- registry/layouts.json: 17 layouts, vendor coordinates and key identities.
- registry/provenance.json: schema, input SHA-256 and counts.
- registry/generated/: original normalized devices, layouts, protocols and defaults.
- registry/protocols.json: generated protocol/model membership.
- registry/defaults.json: separately loaded compact browser preview profiles.
- registry/layout-compatibility.json: preserved Common slots and inherited canvas dimensions.
- scripts/import-generated-data.mjs: validated import of all four normalized JSON tables.
- scripts/extract-vendor-metadata.mjs: literal metadata extraction, no source execution.
- src/data/registry.ts: indexed metadata and usable-capability filtering.
- src/data/keyboard.ts: layout-derived labels, HID usages and firmware slots.
- src/components/KeyboardView.tsx: dynamic renderer.
- src/components/DevicePicker.tsx: searchable keyboard menu with keyboard navigation.
- src/lib/api.ts: browser preview or selected-device Tauri commands.
- src-tauri/src/lib.rs: Tauri command boundary.
- src-tauri/src/models.rs: transport DTOs.
- src-tauri/src/registry.rs: shared-USB identity resolution.
- src-tauri/src/device_manager.rs: enumeration, selection, identity revalidation.
- src-tauri/src/drivers/: seven family codecs, injected transport and mock/golden tests.
- registry/protocol-wire.json: exact per-model packet matrices and button defaults.
- scripts/vendor-protocol-oracle.mjs: external, fingerprinted vendor-method oracle.

## Protocol drivers

The Common driver retains the previous Bushido protocol implementation, including
packet encoding, feature report 7, effect translation, profile validation, timing,
reads and writes. HID transport injection lets the factory supply the selected
interface or a mock. The legacy constructor remains private to this module
and is unused. A source fingerprint and saved legacy slot table guard compatibility.

All seven families have packet codecs selected by canonical model/router identity.
They do not inherit Common's byte format. Packet implementation and hardware
verification are separate: only Bushido can pass the production transport gate.
Unknown router or model identities produce inert summaries. Family-native requests
preserve their own rows and table operations; incompatible Common adapters and
uncertain operations return unsupported. See [protocol coverage and evidence](PROTOCOLS.md).

## Selection and verification

Native commands accept an optional deviceId, preserving previous command names
and arguments. With no ID, discovery prefers the verified model. With an ID, every
operation resolves that exact enumerated HID path and verifies its model again;
a disconnected path returns an error without automatically selecting another
keyboard. Product/hardware names disambiguate shared
VID/PID. A vendor model ID in the serial descriptor can resolve generic names;
conflicting identities stay unknown. Enumeration sends no HID reports. Header
and profile reads happen only for verified models.

advertisedCapabilities represents vendor claims. capabilities represents what the
selected verified driver can currently expose. Unverified models have no usable
capabilities. TFT/sync/actuation stay disabled for every model. Navigation, effect
choices, profile count, FN editor and Snap Tap limit follow these fields. The
device page lists only advertised features and marks unavailable ones unverified.
Browser mode offers all registry models as disconnected previews; native mode
offers detected devices only.

Generated defaults are converted into browser profiles and loaded on demand.
They never replace a native HID read or automatically write a default profile.
The full defaults source remains outside the application bundle. All four input
tables must have consistent source hashes and model/layout/protocol identities.

## Layouts and writes

The renderer uses absolute vendor percentages and exact keyMapping identities.
Bushido remapping uses its original column-scanned firmware slots, including FN
slot 71, rather than visual array indices. Unknown styles render an empty-state
message. See [registry notes](../registry/README.md) for default matrix extraction
and inherited canvas dimensions extracted from embedded vendor stylesheets.

Imports modify editor state; the existing Apply commands perform hardware writes.
Firmware/bootloader operations remain outside this architecture. No vendor
executable code, images, firmware or captures are bundled.

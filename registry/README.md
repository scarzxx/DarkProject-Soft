# Interoperability metadata

The source of the application registries is the user-supplied
DarkProject-generated-data-v1.zip. The four original JSON tables are preserved
in generated/: devices.generated.json, layouts.generated.json,
protocols.generated.json and defaults.generated.json. No proprietary JavaScript,
firmware or images are bundled. These files are data, never executable input.

Run npm run data:import to reproduce devices.json, layouts.json, protocols.json
and defaults.json. The importer checks source hashes, model identities, normal
USB connections, layout geometry, protocol membership and default profile counts.
provenance.json records the hashes of all four inputs and their original sources.

## Devices and protocols

The 45 models keep their vendor SN as the application model ID. sourceId records
the generated table's identifier. productName is the actual USB name; modelName
is the vendor devicename. Both can identify a model, together with VID/PID.
Ambiguous shared names and conflicting identities remain unverified.

The seven protocol families come from protocols.generated.json. Family-level
verification labels are informational. Only Bushido ANSI, SN 0x342D0xE40F012,
uses the existing verified Common driver. The other six families have byte-tested
codecs but remain disabled for hardware access until model verification.
No vendor defaults or protocol family claim can enable HID access.

protocol-wire.json contains packet matrices extracted from the external vendor
bundle. The source fingerprint, supported operations, golden vectors and known
ambiguities are documented in ../docs/PROTOCOLS.md.

## Layouts and compatibility

The 17 styles use generated effectiveKeyMapping and each key's exact CSS geometry.
Numeric and CSS coordinates must agree. Physical key count follows the actual
geometry, including ISO keys; it never follows an inaccurate declaredKeyNumber.
The four formerly empty mappings now come from normalized runtime profiles.

layout-compatibility.json contains previously extracted technical facts absent
from the ZIP: Common firmware slot maps and inherited canvas dimensions for
HFD81US, WITMOD68US, WITMOD69UK, WITMOD83US and WITMOD83UK. Their 8.352rem by 3.6rem
canvas comes from canonical CSS rules in the same source bundle. The importer
checks its bundle hash before using these facts. Vendor CSS itself is not stored.
Bushido's legacy HID-to-slot fixture and Common source fingerprint remain tested.
Visual array indices are never used as firmware slots.

## Defaults

The full defaults.generated.json is a source/research table and is not imported
into the application bundle. The importer derives compact preview profiles:
lighting, performance values, Snap Tap pairs and physical default keybindings.
The resulting defaults.json is loaded separately, only when a browser preview
reads a profile. Native reads always use the unchanged HID driver.

Preview bindings use an explicitly known firmware slot map and USB HID usage.
Keys without these facts do not acquire guessed slots. Missing automatic-effect
colors are represented by black; absent performance fields are zero in previews.
This conversion does not write defaults to hardware or implement a reset command.

The source has one known anomaly: ALU85A default bindings contain 97 entries while
WITMOD68US has 68 physical keys. The renderer uses the 68-key layout; the unrelated
97-entry default list never supplies geometry or firmware slots.

## Validation

Tests cover reproducible import of all four files, inconsistent sources, all
layout coordinates, protocol membership, USB/model aliases, default profile
conversion, picker search, unverified command rejection and the unchanged Bushido
codec. Physical HID reads/writes need a separate hardware regression session.

The older bundle syntax extractor remains available for research and writes to
registry/bundle-extraction/; it does not replace the application registries.

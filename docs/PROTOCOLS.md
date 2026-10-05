# HID drivers and vendor evidence

Dark Control contains independent Rust packet codecs for all seven keyboard router families found in the supplied Dark Project configurator data. All 45 canonical keyboard records in the current vendor registry are treated as **supported models** when their identity and exact HID collection can be resolved. Runtime support is based on the vendor device registry, packet behavior and checked reference vectors; the application does not expose a separate verified/unverified product status.

The two supplied `main.67f2a4ad434666c9*.js` files are identical. Their SHA-256 is `92e38419a4f30f24fb09dbd9dc5da91f2ed637682dc48a65ef2689448d405b46`. Webpack module 8967 exports the audited families through L8, iH, IF, $h, ze, vx and Yo respectively. These names identify the external oracle; vendor source code is not stored in this repository or compiled into the application.

## Implemented packet operations

| Router | Transport | Read and decode | Write |
| --- | --- | --- | --- |
| CommonKeyboardSeries | Feature 7 | Existing complete Bushido profile, settings, bindings, macros, Snap Tap, version | Existing Bushido configuration operations, unchanged |
| DponeSeries | Feature 0, 520-byte payloads | Version with vendor offset detection, selected effect and its parameters, 109 two-byte key rows, named macros, Snap Tap, custom RGB | Effects, custom RGB, complete base/Fn binding buffers, named macros, Snap Tap, clock |
| WitmodSeries | Output/Input 1, 63-byte payloads | Version string, lighting, base/Fn four-byte rows, macro records, Snap Tap; ordered multipart responses | Effects, custom RGB, complete base/Fn tables, complete dense macro table including vendor trailing-slot clearing, Snap Tap |
| TFTKeyboardSeries | Feature 0, prepare/data/finish | Version with ten-attempt acknowledgement flow, lighting | Effects, complete base/Fn tables, complete ordered macro table, clock |
| SparkLinkSeries | Output/Input 0, 64-byte payloads | Version string, lighting, base and three Fn row buffers | Effects, custom RGB, complete supplied key records, macros with an explicit bound key, Snap Tap transitions with prior pairs, preserving vendor cleanup, checksum and block behavior |
| HFDKBSeries | Output/Input 0; selected feature reads | Version, lighting | Effects, complete base/Fn tables, complete ordered macro table, Snap Tap over a supplied base table and known matrix |
| HFDKBRGBSeries | Output/Input 0 with acknowledgements | Version, lighting, game/Snap status, base/Fn rows, custom colors, whole macro storage | Effects, custom RGB, complete base/Fn tables, complete ordered macro table, Snap Tap status and bindings over a supplied base table |

`vendor::Request` expresses family-native operations. Whole buffers always use the model's vendor matrix. `registry/protocol-wire.json` contains model identities, LED/key slot names, vendor HID usages and literal button defaults. A missing mapping stays missing; visual layout indices never substitute for a packet matrix.

## Runtime support model

A keyboard is supported when it resolves to a canonical registry model, its VID/PID and HID collection match vendor metadata, and its `routerID` has an implemented driver. The old generated `verified` field is retained only as source metadata for fixture compatibility and is not used as a runtime gate.

`registry/driver-capabilities.json` is the shared frontend/backend source of truth for app-level feature adapters. A supported model can open its family driver; each page or write action is exposed only when both the vendor capability and the corresponding app adapter exist.

Common exposes its lossless `ProfileState`. Non-Common families read family-native feature/table state and the frontend merges those exact reads with inert vendor defaults only for fields that the family does not expose. Hardware-derived lighting, Snap Tap, bindings and macros remain distinguishable at the adapter boundary; the UI does not invent packet bytes from visual key order.

### Keybinding editor adapters

The existing Keybindings page now uses family-native read/modify/write adapters where the audited implementation provides lossless readback:

- **DPONE:** base-layer rows are read first, the selected two-byte record is changed, then the complete 512-byte vendor buffer is written. FN remains gated because the vendor implementation has a writer but no corresponding lossless FN table readback.
- **Witmod:** Base and FN four-byte tables are read, the exact vendor record is changed, and the complete table is written back. Keyboard, disabled and macro records preserve the vendor byte layout.
- **SparkLink:** Base and FN1 rows are read for the editor. A key change writes the family-native source-key record instead of synthesizing a Common table. Independent macro IDs are not offered because SparkLink macros are bound-key transactions.
- **HFD RGB:** Base and FN rows are read, the selected record is changed, the complete 512-byte table is preserved and written back. A key currently carrying a Snap Tap record is rejected rather than leaving half of a hardware pair behind.

For every adapter, the protocol slot is resolved through the exact vendor key/LED code and `layouts.json` slot map. This is intentionally separate from the visual array index and preserves the existing Bushido rule that visual order is not packet order. Vendor action types that the common editor cannot represent are read as opaque/unknown records and are left untouched until the user explicitly replaces that key with a supported action.

TFT and non-RGB HFD still keep their whole-table key writers behind the driver boundary. Their audited vendor methods do not provide a lossless current-table decoder, so exposing a one-key edit would silently replace unrelated hardware mappings with defaults. The startup risk notice is not used as justification for a destructive hidden reset.

### Macro editor adapters

- **DPONE:** each native macro slot can be read and written independently; UI macro IDs 1..10 map to native slots 0..9.
- **Witmod:** saving one macro first reads all ten slots, patches the selected slot, then writes a dense ten-slot table. This prevents the vendor writer's trailing-slot clearing behavior from deleting unrelated macros.
- **HFD RGB:** the complete macro storage is read, the selected dense slot is patched, and the complete ordered table is rewritten. Sparse writes and destructive gaps are rejected.
- **SparkLink:** remains gated in the standalone Macro page because its macro data must be committed together with an explicit target key.
- **TFT/HFD:** remain gated until the app has a trustworthy current macro-table source; the packet writers themselves remain implemented and covered by vendor vectors.

The native registry consumes vendor HID `usagePage` and `usage` in addition to VID/PID and model identity. `open()` refuses a HID path whose collection does not match the selected model. Discovery is restricted to exact known VID/PID pairs unless the product string is strongly Dark Project branded, preventing unrelated devices from becoming candidates merely because they share a vendor ID.

Ambiguous Witmod devices can use the vendor identity query after selection. It sends output report 1 with command 13, receives the ordered two-block identity response, extracts the second-last comma-separated hardware-name field and resolves it against the registry. This query identifies the model and is not a configuration write. Passive enumeration sends no HID reports.

## Startup consent

Before Dark Control scans or opens HID devices, the user must explicitly accept the startup risk notice. The notice states that Dark Control is unofficial community software, is not published or supported by Dark Project, communicates directly with keyboard firmware, may change device settings, and is used at the user's own risk. A checkbox must be selected before the Continue button is enabled. The notice is available in Czech, Slovak and English and is shown again on the next application launch.

The consent screen is a product safety notice, not a technical permission bypass. Exact identity checks, interface checks and per-operation capability gates remain active after consent.

## Explicit protocol limits

- ALU85A has no matching packet matrix in the supplied bundle. Key-slot-dependent operations are unavailable for this model instead of inventing a mapping.
- TFT/HFD key read routines do not decode a binding table. Their generic macro read routines use a format inconsistent with the actual writer. TFT advertises Snap Tap but has no corresponding family method in the audited implementation.
- HFD and HFD RGB have empty `ApplyTimeSyns` methods. Clock synchronization is not exposed; DPONE/TFT clock writes preserve their prepare/time/finish sequence.
- Witmod has duplicate lighting wire IDs, including Random/Solid/Sine. Readback preserves the vendor first-match behavior. Its custom colors have no implemented vendor readback. Sparse macro tables cannot be treated like independent macro slots because the vendor clears by table length.
- The HFD RGB custom writer allocates 504 bytes although model matrices have 128 slots. Colors outside its 126 writable records are not exposed. Its status writer uses payload byte 8 while the reader uses byte 7; both offsets are preserved rather than speculatively repaired.
- SparkLink maps M19/M20 to the same wire ID. Direction readback is reversed and remains as supplied. Snap Tap has vendor-specific transition constraints and macros require a target key rather than only a macro slot.
- Macro events currently represent keyboard keys. Mouse/compound records that cannot be represented by the current editor are not reinterpreted.
- TFT screen/media upload, advanced actuation/calibration, firmware update, bootloader entry and factory reset are not exposed by Dark Control.

## Transport and validation

`HidTransport` provides feature send/receive, output write, timed input read and delay. Its `HidDevice` implementation delegates directly to hidapi. Common's packet behavior remains under its compatibility fingerprint; the refactor adds transport injection without replacing its established packet logic.

Native writes include the report-ID prefix. Input reports remove a numbered report-ID prefix before family decoding; feature responses retain the bytes returned by the OS. Transactions enforce response bounds, headers, multipart order, terminal blocks and short-write errors. Input waits are bounded, acknowledgement retries follow vendor timing, and failures propagate instead of becoming fabricated success states.

The Rust tests use a queue-driven mock transport for short replies, missing blocks, wrong report IDs, out-of-order blocks, failed writes, disconnects, acknowledgement retries, unsupported operations and unknown identities. App-level adapters are also tested so unavailable operations fail before creating a configuration transport event.

## Golden vectors

`tests/fixtures/vendor-protocol-vectors.json` contains 1,059 cases produced by executing allowlisted methods from the fingerprinted external bundle against a WebHID mock. Each case records inputs, report IDs, complete payloads, synthetic responses, delays and decoded values. These vectors establish packet equivalence with the audited vendor implementation; they are not physical USB captures.

Binding-write vectors provide complete native byte rows to the vendor packet methods. They validate packing and transmission, not an invented translation of every vendor function kind. DPONE reads first query the version to determine the response offset, matching vendor initialization.

Regenerate from the external file while in the repository root:

```powershell
npm run protocol:oracle -- 'C:\Users\scarz\Desktop\main.67f2a4ad434666c9.js'
npm test
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

The oracle refuses other source fingerprints before evaluation. It has no device, network or filesystem API inside its evaluation context. Only technical JSON data and byte vectors are written. Local Node tests can reproduce the external oracle when the proprietary bundle is present; CI skips that reproduction step when the external file is intentionally absent while always running the checked-in Rust vectors.

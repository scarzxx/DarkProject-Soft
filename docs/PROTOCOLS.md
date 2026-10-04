# HID drivers and vendor evidence

Seven router families have independent Rust packet codecs. Only the existing
Bushido ANSI / Common model is hardware verified. Packet equivalence is not
hardware verification: the other 44 models remain blocked by `open`, even though
their family now has an implementation.

The two supplied `main.67f2a4ad434666c9*.js` files are identical. Their SHA-256 is
`92e38419a4f30f24fb09dbd9dc5da91f2ed637682dc48a65ef2689448d405b46`.
Webpack module 8967 exports the audited families through L8, iH, IF, $h, ze, vx
and Yo respectively. These names identify the external oracle; vendor source
code is not stored in this repository or compiled into the application.

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

`vendor::Request` expresses family-native operations. Raw binding rows keep their
family bytes; they are not reinterpreted as Common's `RawKeyBinding.kind`.
Whole buffers must already use the model's vendor matrix. `registry/protocol-wire.json`
contains model identities, LED/key slot names, their vendor HID usages and literal
button defaults. A missing mapping stays missing; visual layout indices never
substitute for a packet matrix.

The existing `ProtocolDriver` commands still serve Bushido. Another family's full
snapshot cannot be represented faithfully by Common's mandatory performance
fields, single-key patch or standalone macro ID. Those adapters return
`unsupported/unverified`; individual native reads and complete-table writes are
available internally through `vendor_request`, without inventing performance
defaults or silently overwriting other macros. No new Tauri command exposes an
ungated transport.

## Explicit limits and ambiguities

- ALU85A has no matching packet matrix in the supplied bundle. Key-slot-dependent
  operations are unsupported for this model.
- TFT/HFD key read routines do not decode a binding table. Their generic macro
  read routines use a format inconsistent with the actual writer. These readers
  are unsupported. TFT advertises Snap Tap but has no corresponding family method.
- HFD and HFD RGB have empty `ApplyTimeSyns` methods. Clock synchronization is
  unsupported; the unused raw time payload is not treated as a complete transaction.
  DPONE/TFT clock writes preserve their prepare/time/finish sequence.
- Witmod has duplicate lighting wire IDs, including Random/Solid/Sine. Readback
  preserves the vendor's first-match choice rather than guessing an effect.
  Its custom colors have no implemented vendor readback. Sparse macro tables are
  unsupported because the vendor clears by table length rather than highest ID.
- The HFD RGB custom writer allocates 504 bytes, even though model matrices have
  128 slots. Colors outside its 126 writable records are unsupported. Its status
  writer uses payload byte 8 while the status reader uses byte 7; both offsets are
  preserved, not repaired speculatively. Left/right read and write directions also
  differ and remain as supplied.
- Sparklink maps M19/M20 to the same wire ID. Direction readback is reversed and
  remains reversed. Snap Tap ignores the vendor enable flag and transmits only
  ten pairs before its checksum becomes undefined; disable and larger transitions
  are unsupported. A transition requires the prior pairs, and cleanup must fit the
  single vendor packet. Macros require a target key, not just a macro slot.
- Macro events currently represent keyboard keys. Unsupported mouse/compound
  records are rejected rather than reinterpreted. Some vendor macro decoders drop
  delay high bytes; the decoders preserve that behavior and vectors demonstrate it.
- Performance, generic profile switching, TFT screen/media upload, advanced
  actuation and calibration APIs are unsupported/unverified. They are not exposed
  through a guessed fallback driver. Firmware, bootloader and factory-reset
  operations do not exist in the request enum or oracle allowlist.

## Transport and validation

`HidTransport` provides feature send/receive, output write, timed input read and
delay. Its `HidDevice` implementation delegates directly to hidapi. Common's
only refactor is transport injection: packet logic, errors, report lengths,
legacy delays and fallback behavior remain under the original source fingerprint.

Native writes include the report-ID prefix. Input reports remove a numbered
report-ID prefix before the family decoder; feature responses retain the bytes
returned by the OS. These conventions follow the [hidapi API](https://github.com/libusb/hidapi/blob/master/hidapi/hidapi.h)
and [WebHID report rules](https://wicg.github.io/webhid/#dom-hiddevice-receivefeaturereport).
Cross-platform physical framing for unverified models still needs hardware tests.

Transactions enforce response bounds, headers, multipart order, terminal blocks
and short-write errors. Input waits use a three-second safety limit. HFD RGB
acknowledgements retry twice with the vendor ten-millisecond interval. TFT version
reads preserve their conditional prepare/ack/data/finish flow. Errors propagate;
they never become a successful write or a fabricated state.

The discrete Rust tests use a queue-driven mock transport for short replies,
missing blocks, wrong report IDs, out-of-order blocks, failed writes, disconnects,
acknowledgement retries, unsupported operations and unknown identities.

## Golden vectors

`tests/fixtures/vendor-protocol-vectors.json` contains 1,059 cases produced by
executing allowlisted methods from the fingerprinted external bundle against a
WebHID mock. Each case records inputs, report IDs, complete payloads, synthetic
responses, delays and decoded values. HFD RGB's packet/decoder methods are real;
its asynchronous acknowledgement queue is replaced by the harness. Rust tests
separately exercise the native acknowledgement transport. No fixture pretends to
be a physical capture.

Binding-write vectors provide complete native byte rows to the vendor packet
methods. They validate packing and transmission, not a new binding editor's
translation of every vendor function kind. DPONE reads first query the version
to determine the response offset, as in vendor initialization.

The Common lighting cases supply the already-preserved vendor control bytes and
translate its legacy clockwise input convention before calling the vendor oracle.
Common's established timing is kept, including differences from the vendor UI.
Packet equality and unchanged behavior are separate assertions.

Regenerate from the external file, while in the repository root:

```powershell
npm run protocol:oracle -- 'C:\Users\scarz\Desktop\main.67f2a4ad434666c9.js'
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

The oracle refuses other source fingerprints before evaluation. It has no device,
network or filesystem API inside its evaluation context. Only technical JSON data
and byte vectors are written. Local Node tests also re-run the external oracle and
compare every vector and matrix; CI skips that one reproduction test when the
proprietary external file is unavailable, while always running the Rust vectors.

use crate::models::*;
use super::transport::HidTransport;
use hidapi::{HidApi, HidDevice};
use std::{collections::BTreeSet, thread, time::Duration};
use thiserror::Error;

pub const VID: u16 = 0x342D;
pub const PID: u16 = 0xE40F;
pub const REPORT_ID: u8 = 7;
pub const PROFILE_COUNT: u8 = 3;
pub const KEY_SLOTS: usize = 96;

#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("HID error: {0}")]
    Hid(#[from] hidapi::HidError),
    #[error("No supported Dark Project keyboard found")]
    NotFound,
    #[error("Profile must be 0, 1 or 2")]
    BadProfile,
    #[error("Unsupported lighting effect {0}")]
    UnsupportedEffect(u8),
    #[error("Invalid key slot {0}")]
    BadSlot(usize),
    #[error("Invalid polling rate {0}")]
    BadPolling(u16),
    #[error("Invalid input latency {0}")]
    BadLatency(u8),
    #[error("Device returned a short report")]
    ShortReport,
    #[error("Too many Snap Tap pairs (maximum 20)")]
    TooManySnapPairs,
    #[error("Macro payload is too large")]
    MacroTooLarge,
}

pub type Result<T> = std::result::Result<T, ProtocolError>;

pub struct Keyboard<T: HidTransport = HidDevice> {
    pub(super) device: T,
    pub product_name: String,
    pub serial_number: Option<String>,
}

impl Keyboard<HidDevice> {
    pub fn open() -> Result<Self> {
        let api = HidApi::new()?;
        let info = api
            .device_list()
            .filter(|d| d.vendor_id() == VID && d.product_id() == PID)
            .max_by_key(|d| {
                let product = d.product_string().unwrap_or_default();
                (if product.starts_with("DPKB_") { 4 } else { 0 })
                    + (if d.usage_page() == 0xFF01 { 2 } else { 0 })
            })
            .ok_or(ProtocolError::NotFound)?;

        let product_name = info
            .product_string()
            .unwrap_or("Dark Project Keyboard")
            .to_string();
        let serial_number = info.serial_number().map(ToOwned::to_owned);
        let device = info.open_device(&api)?;
        Ok(Self { device, product_name, serial_number })
    }

}

impl<T: HidTransport> Keyboard<T> {
    fn validate_profile(profile: u8) -> Result<()> {
        if profile < PROFILE_COUNT { Ok(()) } else { Err(ProtocolError::BadProfile) }
    }

    fn send(&self, payload: &[u8]) -> Result<()> {
        let mut report = Vec::with_capacity(payload.len() + 1);
        report.push(REPORT_ID);
        report.extend_from_slice(payload);
        self.device.send_feature_report(&report)?;
        Ok(())
    }

    fn query(&self, payload: &[u8]) -> Result<Vec<u8>> {
        self.send(payload)?;
        self.device.delay(20);
        let mut response = vec![0u8; 512];
        response[0] = REPORT_ID;
        let len = self.device.get_feature_report(&mut response)?;
        if len < 8 { return Err(ProtocolError::ShortReport); }
        response.truncate(len);
        Ok(response)
    }

    pub fn firmware_version(&self) -> Result<String> {
        let mut req = vec![0u8; 264];
        req[0] = 0x88;
        let r = self.query(&req)?;
        if r.len() <= 15 { return Err(ProtocolError::ShortReport); }
        let version = (((r[14] as u16) & 0x0F) << 8) | r[15] as u16;
        // Vendor UI renders this field as hexadecimal (e.g. decimal 39 => "v27").
        Ok(format!("v{:x}", version))
    }

    pub fn current_profile(&self) -> Result<u8> {
        let mut req = vec![0u8; 264];
        req[0] = 0x81;
        let r = self.query(&req)?;
        let raw = *r.get(2).ok_or(ProtocolError::ShortReport)?;
        // Hardware reports 1..3. Keep a guarded fallback for odd firmware revisions.
        Ok(if (1..=PROFILE_COUNT).contains(&raw) { raw - 1 } else { raw.min(PROFILE_COUNT - 1) })
    }

    pub fn read_profile_raw(&self, profile: u8) -> Result<Vec<u8>> {
        Self::validate_profile(profile)?;
        let mut req = vec![0u8; 256];
        req[0] = 0x82;
        req[1] = profile + 1;
        self.query(&req)
    }

    pub fn read_settings_raw(&self) -> Result<Vec<u8>> {
        let mut req = vec![0u8; 264];
        req[0] = 0x8B;
        self.query(&req)
    }

    pub fn read_snap_raw(&self, profile: u8) -> Result<Vec<u8>> {
        Self::validate_profile(profile)?;
        let mut req = vec![0u8; 264];
        req[0] = 0x89;
        req[1] = profile + 1;
        self.query(&req)
    }

    pub fn read_keys_raw(&self, profile: u8, layer: u8) -> Result<Vec<u8>> {
        Self::validate_profile(profile)?;
        let mut req = vec![0u8; 264];
        req[0] = 0x83;
        req[1] = profile + 1;
        req[2] = layer.clamp(1, 2);
        self.query(&req)
    }

    fn parse_keys(raw: &[u8]) -> Vec<RawKeyBinding> {
        if raw.len() < 200 { return Vec::new(); }
        (0..KEY_SLOTS)
            .map(|slot| RawKeyBinding {
                slot,
                code: raw[8 + slot],
                kind: raw[104 + slot],
            })
            .collect()
    }

    pub fn read_macro(&self, macro_id: u8) -> Result<MacroDefinition> {
        let mut req = vec![0u8; 264];
        req[0] = 0x85;
        req[1] = macro_id;
        let raw = self.query(&req)?;
        let mut events = Vec::new();
        for i in 0..80usize {
            let off = 8 + i * 3;
            if off + 2 >= raw.len() { break; }
            let high = raw[off];
            let low = raw[off + 1];
            let hid = raw[off + 2];
            if hid == 0 { break; }
            let pressed = high < 128;
            let delay_hi = if pressed { high } else { high - 128 };
            let delay = ((delay_hi as u16) << 8) | low as u16;
            events.push(MacroEvent { hid, delay, pressed });
        }
        Ok(MacroDefinition { id: macro_id, events })
    }

    pub fn read_profile(&self, profile: u8) -> Result<ProfileState> {
        let raw = self.read_profile_raw(profile)?;
        if raw.len() < 200 { return Err(ProtocolError::ShortReport); }

        let settings = self.read_settings_raw()?;
        let snap = self.read_snap_raw(profile)?;
        let base_raw = self.read_keys_raw(profile, 1)?;
        let fn_raw = self.read_keys_raw(profile, 2)?;
        let key_bindings = Self::parse_keys(&base_raw);
        let fn_key_bindings = Self::parse_keys(&fn_raw);

        let hid_effect = raw[9];
        let effect = hid_to_profile_effect(hid_effect).ok_or(ProtocolError::UnsupportedEffect(hid_effect))?;
        let brightness = raw
            .get(10 + hid_effect as usize)
            .copied()
            .unwrap_or(4)
            .saturating_mul(25)
            .min(100);
        let rate_store = raw.get(24 + hid_effect as usize).copied().unwrap_or(2);
        let speed = 25u8.saturating_mul(5u8.saturating_sub(rate_store)).min(100);
        let direction = if effect == 1 {
            raw.get(84).copied().unwrap_or(0).min(1)
        } else {
            match raw.get(52).copied().unwrap_or(0) {
                0 => 0,
                3 => 1,
                1 => 2,
                2 => 3,
                _ => 0,
            }
        };
        let color = [
            *raw.get(59).unwrap_or(&148),
            *raw.get(67).unwrap_or(&5),
            *raw.get(75).unwrap_or(&57),
        ];
        let multicolor = raw.get(38 + hid_effect as usize).copied().unwrap_or(0) == 8;

        // These bytes exist in the family packet, but Bushido advertises PerformanceFlag=false.
        // We still preserve/read them for profile compatibility; the UI capability layer hides them.
        let polling_rate = match raw.get(8).copied().unwrap_or(4) {
            1 => 125,
            2 => 250,
            3 => 500,
            4 => 1000,
            _ => 1000,
        };
        let input_latency = match raw.get(88).copied().unwrap_or(1) {
            0 => 0,
            1 => 2,
            2 => 8,
            3 => 12,
            _ => 2,
        };
        let debounce = settings.get(3).copied().unwrap_or(5);
        let sleep_time = settings.get(2).copied().unwrap_or(0);

        let snap_tap_enabled = snap.get(8).copied().unwrap_or(0) != 0;
        let mut snap_tap_pairs = Vec::new();
        for i in 0..20usize {
            let off = 9 + i * 3;
            if off + 2 >= snap.len() || snap[off + 1] == 0 { break; }
            snap_tap_pairs.push(SnapPair {
                kind: snap[off],
                key1: snap[off + 1],
                key2: snap[off + 2],
            });
        }

        let macro_ids: BTreeSet<u8> = key_bindings
            .iter()
            .chain(fn_key_bindings.iter())
            .filter(|b| b.kind == 5 && b.code != 0)
            .map(|b| b.code)
            .collect();
        let mut macros = Vec::new();
        for id in macro_ids {
            if let Ok(m) = self.read_macro(id) { macros.push(m); }
        }

        Ok(ProfileState {
            profile,
            lighting: LightingSettings { effect, brightness, speed, direction, color, multi_color: multicolor },
            performance: PerformanceSettings { polling_rate, input_latency, debounce, sleep_time },
            snap_tap_enabled,
            snap_tap_pairs,
            key_bindings,
            fn_key_bindings,
            macros,
        })
    }

    pub fn switch_profile(&self, profile: u8) -> Result<()> {
        Self::validate_profile(profile)?;
        let mut p = vec![0u8; 264];
        p[0] = 0x01;
        p[1] = profile + 1;
        self.send(&p)
    }

    pub fn apply_lighting(&self, profile: u8, s: &LightingSettings) -> Result<()> {
        Self::validate_profile(profile)?;
        let hid = profile_to_hid_effect(s.effect).ok_or(ProtocolError::UnsupportedEffect(s.effect))?;
        let raw = self.read_profile_raw(profile)?;
        if raw.len() < 200 { return Err(ProtocolError::ShortReport); }

        let mut p = vec![0u8; 256];
        let copy_len = (raw.len() - 1).min(p.len());
        p[..copy_len].copy_from_slice(&raw[1..1 + copy_len]);
        p[0] = 0x02;
        p[8] = hid;
        p[9 + hid as usize] = ((4.0 * s.brightness.min(100) as f32 / 100.0).ceil() as u8).min(4);
        p[23 + hid as usize] = (5.0 - 4.0 * s.speed.min(100) as f32 / 100.0)
            .round()
            .clamp(1.0, 5.0) as u8;
        p[37 + hid as usize] = if s.multi_color { 8 } else { 0 };
        if s.effect == 1 {
            p[83] = s.direction.min(1);
        } else {
            p[51] = match s.direction { 0 => 0, 1 => 3, 2 => 1, 3 => 2, _ => 0 };
        }
        p[52] = 0;
        p[58] = s.color[0];
        p[66] = s.color[1];
        p[74] = s.color[2];
        self.send(&p)
    }

    pub fn apply_performance(&self, profile: u8, s: &PerformanceSettings) -> Result<()> {
        Self::validate_profile(profile)?;
        let poll_idx = match s.polling_rate {
            125 => 1,
            250 => 2,
            500 => 3,
            1000 => 4,
            x => return Err(ProtocolError::BadPolling(x)),
        };
        let latency_idx = match s.input_latency {
            0 => 0,
            2 => 1,
            8 => 2,
            12 => 3,
            x => return Err(ProtocolError::BadLatency(x)),
        };
        let raw = self.read_profile_raw(profile)?;
        if raw.len() < 200 { return Err(ProtocolError::ShortReport); }
        let mut p = vec![0u8; 256];
        let copy_len = (raw.len() - 1).min(p.len());
        p[..copy_len].copy_from_slice(&raw[1..1 + copy_len]);
        p[0] = 0x02;
        p[7] = poll_idx;
        p[87] = latency_idx;
        self.send(&p)?;
        thread::sleep(Duration::from_millis(20));
        let mut time = vec![0u8; 264];
        time[0] = 0x0B;
        time[1] = s.sleep_time;
        time[2] = s.debounce;
        self.send(&time)
    }

    pub fn apply_snap_tap(&self, profile: u8, enabled: bool, pairs: &[SnapPair]) -> Result<()> {
        Self::validate_profile(profile)?;
        if pairs.len() > 20 { return Err(ProtocolError::TooManySnapPairs); }
        let mut p = vec![0u8; 264];
        p[0] = 0x09;
        p[1] = profile + 1;
        p[2] = if enabled { 1 } else { 0 };
        for (i, pair) in pairs.iter().enumerate() {
            let off = 7 + i * 3;
            p[off] = pair.kind;
            p[off + 1] = pair.key1;
            p[off + 2] = pair.key2;
        }
        self.send(&p)
    }

    pub fn apply_key_binding(&self, profile: u8, layer: u8, patch: &RawKeyBinding) -> Result<()> {
        Self::validate_profile(profile)?;
        if patch.slot >= KEY_SLOTS { return Err(ProtocolError::BadSlot(patch.slot)); }
        let current = self.read_keys_raw(profile, layer)?;
        if current.len() < 200 { return Err(ProtocolError::ShortReport); }
        let mut p = vec![0u8; 264];
        p[0] = 0x03;
        p[1] = profile + 1;
        p[2] = layer.clamp(1, 2);
        for i in 0..KEY_SLOTS {
            p[7 + i] = current[8 + i];
            p[7 + KEY_SLOTS + i] = current[104 + i];
        }
        p[7 + patch.slot] = patch.code;
        p[7 + KEY_SLOTS + patch.slot] = patch.kind;
        self.send(&p)
    }

    pub fn write_macro(&self, macro_id: u8, events: &[MacroEvent]) -> Result<()> {
        if events.len() > 80 { return Err(ProtocolError::MacroTooLarge); }
        let mut p = vec![0u8; 256];
        p[0] = 0x05;
        p[1] = macro_id;
        for (i, event) in events.iter().enumerate() {
            let mut hi = ((event.delay >> 8) as u8) & 0x7F;
            if !event.pressed { hi |= 0x80; }
            let off = 7 + i * 3;
            p[off] = hi;
            p[off + 1] = event.delay as u8;
            p[off + 2] = event.hid;
        }
        self.send(&p)
    }
}

pub fn profile_to_hid_effect(effect: u8) -> Option<u8> {
    Some(match effect {
        0 => 0, 1 => 6, 2 => 2, 3 => 7, 4 => 4, 5 => 8, 6 => 1, 7 => 3,
        8 => 5, 9 => 9, 10 => 10, 11 => 11, 12 => 12, 13 => 13, 19 => 14,
        _ => return None,
    })
}

pub fn hid_to_profile_effect(hid: u8) -> Option<u8> {
    Some(match hid {
        0 => 0, 6 => 1, 2 => 2, 7 => 3, 4 => 4, 8 => 5, 1 => 6, 3 => 7,
        5 => 8, 9 => 9, 10 => 10, 11 => 11, 12 => 12, 13 => 13, 14 => 19,
        _ => return None,
    })
}

use super::transport::HidTransport;
use crate::{
    models::{LightingSettings, MacroEvent, SnapPair},
    registry::DeviceMetadata,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{cell::Cell, collections::HashMap, sync::OnceLock};

pub type Result<T> = std::result::Result<T, String>;

/// Family-native operations do not reinterpret Common's binding kinds or macro IDs.
#[derive(Debug)]
pub enum Request {
    Version,
    ReadLighting,
    Lighting(LightingSettings),
    ReadSnap,
    Snap {
        enabled: bool,
        pairs: Vec<SnapPair>,
    },
    ReadKeys {
        layer: u8,
    },
    WriteKeys {
        layer: u8,
        data: Vec<u8>,
    },
    ReadMacro {
        id: u8,
    },
    WriteMacro {
        id: u8,
        name: String,
        events: Vec<MacroEvent>,
    },
    MacroTable(Vec<MacroRecord>),
    BoundMacro {
        key: u8,
        events: Vec<MacroEvent>,
    },
    CustomLighting {
        settings: LightingSettings,
        colors: Vec<Pixel>,
    },
    ReadCustom,
    SnapWithKeys {
        enabled: bool,
        pairs: Vec<SnapPair>,
        keys: Vec<u8>,
    },
    SnapTransition {
        pairs: Vec<SnapPair>,
        previous: Vec<SnapPair>,
    },
    Clock(Clock),
}

#[derive(Debug, Deserialize)]
pub struct Clock {
    pub enabled: bool,
    pub year: u16,
    pub month: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: u8,
    pub second: u8,
    pub weekday: u8,
}

pub fn clock(time: &Clock, delay: u64) -> Result<Step> {
    if !(1..=12).contains(&time.month)
        || !(1..=31).contains(&time.day)
        || time.hour > 23
        || time.minute > 59
        || time.second > 59
        || time.weekday > 6
    {
        return Err("Invalid device clock fields".into());
    }
    let mut data = vec![0; 65];
    data[1..10].copy_from_slice(&[
        90,
        u8::from(time.enabled),
        90,
        (time.year % 2000) as u8,
        time.month,
        time.day,
        time.hour,
        time.minute,
        time.second,
    ]);
    data[11] = time.weekday;
    data[63] = 170;
    data[64] = 85;
    Ok(feature(data, delay, false))
}

#[derive(Debug, Deserialize)]
pub struct Pixel {
    pub slot: usize,
    pub color: [u8; 3],
}

#[derive(Debug, Deserialize)]
pub struct MacroRecord {
    pub id: u8,
    pub name: String,
    pub events: Vec<MacroEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireModel {
    pub router_id: String,
    pub style_name: String,
    pub led_codes: Vec<String>,
    pub button_defaults: Vec<u8>,
    pub key_hids: Vec<Option<u8>>,
    pub key_codes: Vec<String>,
    pub led_hids: Vec<Option<u8>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireRegistry {
    source_sha256: String,
    models: HashMap<String, WireModel>,
}

static MODELS: OnceLock<Result<HashMap<String, WireModel>>> = OnceLock::new();

/// Resolve packet dimensions from the exact vendor model, never visual key count.
pub fn model(metadata: &DeviceMetadata) -> Result<&'static WireModel> {
    let models = MODELS.get_or_init(|| {
        serde_json::from_str::<WireRegistry>(include_str!("../../../registry/protocol-wire.json"))
            .map_err(|error| format!("Invalid protocol model data: {error}"))
            .and_then(|registry| {
                if registry.source_sha256
                    != "92e38419a4f30f24fb09dbd9dc5da91f2ed637682dc48a65ef2689448d405b46"
                {
                    return Err("Unsupported protocol data provenance".into());
                }
                Ok(registry.models)
            })
    });
    let item = models
        .as_ref()
        .map_err(Clone::clone)?
        .get(&metadata.id)
        .ok_or_else(|| "unsupported: no vendor packet matrix for model".to_owned())?;
    if item.router_id != metadata.router_id || item.style_name != metadata.style_name {
        return Err("unsupported: inconsistent model/router/layout identity".into());
    }
    Ok(item)
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Packet {
    pub channel: &'static str,
    pub report_id: u8,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone)]
pub enum Receive {
    None,
    Feature,
    Input {
        prefix: Vec<u8>,
        end: InputEnd,
        retry: bool,
    },
}

#[derive(Debug, Clone)]
pub enum InputEnd {
    One,
    Count(usize),
    Packet { offset: usize, last: u8 },
    Short { offset: usize, full: u8, max: usize },
}

#[derive(Debug, Clone)]
pub enum Step {
    Send {
        packet: Packet,
        delay: u64,
        receive: Receive,
    },
    Feature {
        report_id: u8,
    },
    Delay(u64),
}

pub fn feature(data: Vec<u8>, delay: u64, query: bool) -> Step {
    Step::Send {
        packet: Packet {
            channel: "feature",
            report_id: 0,
            data,
        },
        delay,
        receive: if query {
            Receive::Feature
        } else {
            Receive::None
        },
    }
}

pub fn output(report_id: u8, data: Vec<u8>, delay: u64) -> Step {
    Step::Send {
        packet: Packet {
            channel: "output",
            report_id,
            data,
        },
        delay,
        receive: Receive::None,
    }
}

pub fn input(
    report_id: u8,
    data: Vec<u8>,
    prefix: Vec<u8>,
    end: InputEnd,
    delay: u64,
    retry: bool,
) -> Step {
    Step::Send {
        packet: Packet {
            channel: "output",
            report_id,
            data,
        },
        delay,
        receive: Receive::Input { prefix, end, retry },
    }
}

/// Pure codecs may decline operations without constructing any HID packet.
pub trait Codec {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>>;
    fn decode(&self, request: &Request, replies: &[Vec<u8>], offset: usize) -> Result<Value>;
    fn macro_data(&self, _id: u8, _name: &str, _events: &[MacroEvent]) -> Result<Vec<u8>> {
        unsupported("macro encoding")
    }
    fn follow_up(&self, _request: &Request, _replies: &[Vec<u8>]) -> Result<Vec<Step>> {
        Ok(Vec::new())
    }
}

pub fn macro_table(codec: &dyn Codec, macros: &[MacroRecord]) -> Result<Vec<u8>> {
    if macros.is_empty() || macros.len() > 10 {
        return Err("A complete macro table must contain 1..10 macros".into());
    }
    let mut data = vec![0; 400];
    for (i, item) in macros.iter().enumerate() {
        if item.id as usize != i {
            return unsupported("macro table IDs must match hardware binding order");
        }
        let offset = u16::try_from(data.len()).map_err(|_| "Macro table too large")?;
        data[4 * i..4 * i + 2].copy_from_slice(&offset.to_le_bytes());
        data.extend_from_slice(&codec.macro_data(item.id, &item.name, &item.events)?);
    }
    Ok(data)
}

pub fn unsupported<T>(operation: &str) -> Result<T> {
    Err(format!("unsupported/unverified: {operation}"))
}

pub fn require(data: &[u8], length: usize) -> Result<()> {
    if data.len() < length {
        Err("Device returned a short report".into())
    } else {
        Ok(())
    }
}

pub fn last(replies: &[Vec<u8>]) -> Result<&[u8]> {
    replies
        .last()
        .map(Vec::as_slice)
        .ok_or_else(|| "Missing HID response".into())
}

pub fn levels(settings: &LightingSettings, effects: &[(u8, u8)]) -> Result<u8> {
    if settings.brightness > 100 || settings.speed > 100 {
        return Err("Brightness and speed must be 0..100".into());
    }
    effects
        .iter()
        .find(|(id, _)| *id == settings.effect)
        .map(|(_, wire)| *wire)
        .ok_or_else(|| format!("unsupported: lighting effect {}", settings.effect))
}

pub fn percent(value: u8, maximum: u16) -> u8 {
    (u16::from(value) * maximum).div_ceil(100) as u8
}

pub fn direction(value: u8, map: &[u8]) -> Result<u8> {
    map.get(value as usize)
        .copied()
        .ok_or_else(|| "unsupported: lighting direction".into())
}

pub fn effect_from_wire(value: u8, effects: &[(u8, u8)]) -> Result<u8> {
    effects
        .iter()
        .find(|(_, wire)| *wire == value)
        .map(|(id, _)| *id)
        .ok_or_else(|| format!("unsupported: wire lighting effect {value}"))
}

/// Optional fields remain absent when the vendor decoder never reads them.
pub fn lighting(
    effect: u8,
    brightness: u16,
    speed: u16,
    dir: u8,
    multi: bool,
    color: Option<[u8; 3]>,
) -> Value {
    json!({"effect": effect, "brightness": brightness, "speed": speed,
        "direction": dir, "multiColor": multi, "color": color})
}

/// Execute bounded, ordered transactions. Mock and native paths use identical logic.
pub struct Keyboard<T: HidTransport> {
    pub transport: T,
    pub codec: Box<dyn Codec>,
    pub model: &'static WireModel,
    pub metadata: &'static DeviceMetadata,
    offset: Cell<Option<usize>>,
}

impl<T: HidTransport> Keyboard<T> {
    pub fn new(
        transport: T,
        codec: Box<dyn Codec>,
        metadata: &'static DeviceMetadata,
    ) -> Result<Self> {
        Ok(Self {
            transport,
            codec,
            model: model(metadata)?,
            metadata,
            offset: Cell::new(None),
        })
    }

    fn receive_feature(&self, report_id: u8) -> Result<Vec<u8>> {
        let mut data = vec![0; 1024];
        data[0] = report_id;
        let length = self
            .transport
            .get_feature_report(&mut data)
            .map_err(|e| e.to_string())?;
        if length == 0 || length > data.len() {
            return Err("Invalid feature report length".into());
        }
        data.truncate(length);
        Ok(data)
    }

    fn receive_input(
        &self,
        report_id: u8,
        prefix: &[u8],
        end: &InputEnd,
        active_reports: bool,
    ) -> Result<Vec<Vec<u8>>> {
        let mut replies = Vec::new();
        let maximum = match end {
            InputEnd::One => 1,
            InputEnd::Count(count) => *count,
            InputEnd::Packet { last, .. } => *last as usize + 1,
            InputEnd::Short { max, .. } => *max,
        };
        if maximum > 128 {
            return Err("Invalid input block count".into());
        }
        for index in 0..maximum {
            let started = std::time::Instant::now();
            let mut skipped = 0;
            let data = loop {
                let mut data = vec![0; 1024];
                let remaining = 3000u128.saturating_sub(started.elapsed().as_millis()) as i32;
                if remaining == 0 {
                    return Err("HID input response timed out".into());
                }
                let length = self
                    .transport
                    .read_timeout(&mut data, remaining)
                    .map_err(|e| e.to_string())?;
                if length == 0 || length > data.len() {
                    return Err("HID input response timed out".into());
                }
                data.truncate(length);
                if report_id != 0 {
                    if data[0] != report_id {
                        return Err("Unexpected input report ID".into());
                    }
                    data.remove(0);
                }
                if active_reports
                    && (data.starts_with(&[85, 250, 7])
                        || data.starts_with(&[40, 1, 1])
                        || data == [11, 11]
                        || data == [11, 14])
                {
                    skipped += 1;
                    if skipped >= 64 {
                        return Err("Too many unsolicited HID reports".into());
                    }
                    continue;
                }
                break data;
            };
            if !data.starts_with(prefix) {
                return Err("Unexpected HID response header".into());
            }
            let complete = match end {
                InputEnd::One => true,
                InputEnd::Count(count) => index + 1 == *count,
                InputEnd::Packet { offset, last } => {
                    let number = *data.get(*offset).ok_or("Short input block")?;
                    if number as usize != index {
                        return Err("Unexpected input block order".into());
                    }
                    number == *last
                }
                InputEnd::Short { offset, full, .. } => {
                    if *data.get(3).ok_or("Short input block")? as usize != index {
                        return Err("Unexpected input block order".into());
                    }
                    let count = *data.get(*offset).ok_or("Short input block")?;
                    if count > *full {
                        return Err("Invalid input block length".into());
                    }
                    count < *full
                }
            };
            replies.push(data);
            if complete {
                return Ok(replies);
            }
        }
        Err("Incomplete HID input response".into())
    }

    pub fn execute(&self, request: &Request) -> Result<Value> {
        if matches!(
            request,
            Request::WriteKeys { .. } | Request::SnapWithKeys { .. }
        ) && self.model.led_codes.is_empty()
        {
            return unsupported("no vendor matrix for slot-dependent model operations");
        }
        match request {
            Request::Lighting(settings)
                if !self
                    .metadata
                    .capabilities
                    .lighting_effects
                    .contains(&settings.effect) =>
            {
                return unsupported("effect is not advertised by this model")
            }
            Request::Snap { pairs, .. }
                if !self.metadata.capabilities.snap_tap
                    || pairs.len() > self.metadata.capabilities.max_snap_tap_pairs as usize =>
            {
                return unsupported("model Snap Tap capability or pair limit")
            }
            _ => {}
        }
        let plan = self.codec.encode(request, self.model)?;
        if self.metadata.router_id == "DponeSeries"
            && self.offset.get().is_none()
            && matches!(
                request,
                Request::ReadLighting
                    | Request::ReadSnap
                    | Request::ReadKeys { .. }
                    | Request::ReadMacro { .. }
                    | Request::ReadCustom
            )
        {
            self.execute(&Request::Version)?;
        }
        if matches!(request, Request::Version) && self.metadata.router_id == "TFTKeyboardSeries" {
            return super::tft::read_version(self);
        }
        let mut replies = self.execute_plan(plan)?;
        let follow_up = self.codec.follow_up(request, &replies)?;
        replies.extend(self.execute_plan(follow_up)?);
        if matches!(request, Request::Version) && self.metadata.router_id == "DponeSeries" {
            let data = last(&replies)?;
            require(data, 86)?;
            if data[84] == 0 && data[85] == 0 {
                return unsupported("DPONE response offset requires a valid firmware version");
            }
            if data[85] > 0 {
                self.offset.set(Some(1));
            } else if self.offset.get().is_none() {
                self.offset.set(Some(0));
            }
        }
        self.codec
            .decode(request, &replies, self.offset.get().unwrap_or(0))
    }

    pub(super) fn execute_plan(&self, plan: Vec<Step>) -> Result<Vec<Vec<u8>>> {
        let mut replies = Vec::new();
        for step in plan {
            match step {
                Step::Delay(ms) => self.transport.delay(ms),
                Step::Feature { report_id } => replies.push(self.receive_feature(report_id)?),
                Step::Send {
                    packet,
                    delay,
                    receive,
                } => {
                    let mut data = Vec::with_capacity(packet.data.len() + 1);
                    data.push(packet.report_id);
                    data.extend_from_slice(&packet.data);
                    let attempts = if matches!(receive, Receive::Input { retry: true, .. }) {
                        2
                    } else {
                        1
                    };
                    for attempt in 0..attempts {
                        let received = (|| {
                            if packet.channel == "feature" {
                                self.transport
                                    .send_feature_report(&data)
                                    .map_err(|e| e.to_string())?;
                            } else {
                                let length =
                                    self.transport.write(&data).map_err(|e| e.to_string())?;
                                if length != data.len() {
                                    return Err("Short HID write".into());
                                }
                            }
                            if delay > 0 {
                                self.transport.delay(delay);
                            }
                            match &receive {
                                Receive::None => Ok(Vec::new()),
                                Receive::Feature => {
                                    self.receive_feature(packet.report_id).map(|r| vec![r])
                                }
                                Receive::Input { prefix, end, retry } => {
                                    self.receive_input(packet.report_id, prefix, end, *retry)
                                }
                            }
                        })();
                        match received {
                            Ok(data) => {
                                replies.extend(data);
                                break;
                            }
                            Err(error) if attempt + 1 == attempts => return Err(error),
                            Err(_) => self.transport.delay(10),
                        }
                    }
                }
            }
        }
        Ok(replies)
    }
}

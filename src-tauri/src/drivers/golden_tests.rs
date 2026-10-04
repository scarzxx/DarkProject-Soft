use super::transport::mock::{Event, MockTransport};
use super::vendor::{Codec, Packet, Request, Step, WireModel};
use super::*;
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
struct Fixture {
    vectors: Vec<Vector>,
}
#[derive(Deserialize)]
struct Vector {
    family: String,
    operation: String,
    input: Value,
    packets: Vec<ExpectedPacket>,
    replies: Vec<Vec<u8>>,
    expected: Value,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedPacket {
    channel: String,
    report_id: u8,
    data: Vec<u8>,
}

fn family(router: &str) -> &str {
    match router {
        "CommonKeyboardSeries" => "common",
        "DponeSeries" => "dpone",
        "WitmodSeries" => "witmod",
        "TFTKeyboardSeries" => "tft",
        "SparkLinkSeries" => "sparklink",
        "HFDKBSeries" => "hfd",
        "HFDKBRGBSeries" => "hfd_rgb",
        _ => "unknown",
    }
}

fn request(vector: &Vector) -> Request {
    let input = &vector.input;
    match vector.operation.as_str() {
        "lighting" => Request::Lighting(serde_json::from_value(input.clone()).unwrap()),
        "version" => Request::Version,
        "readLighting" => Request::ReadLighting,
        "readMacro" => Request::ReadMacro { id: 2 },
        "clock" => Request::Clock(serde_json::from_value(input.clone()).unwrap()),
        "snap" => Request::Snap {
            enabled: input["enabled"].as_bool().unwrap(),
            pairs: serde_json::from_value(input["pairs"].clone()).unwrap(),
        },
        "writeKeys" => Request::WriteKeys {
            layer: input["layer"].as_u64().unwrap() as u8,
            data: serde_json::from_value(input["data"].clone()).unwrap(),
        },
        "writeMacro" => Request::WriteMacro {
            id: input["id"].as_u64().unwrap() as u8,
            name: input["name"].as_str().unwrap().into(),
            events: serde_json::from_value(input["events"].clone()).unwrap(),
        },
        "macroTable" => {
            Request::MacroTable(serde_json::from_value(input["macros"].clone()).unwrap())
        }
        "boundMacro" => Request::BoundMacro {
            key: input["key"].as_u64().unwrap() as u8,
            events: serde_json::from_value(input["events"].clone()).unwrap(),
        },
        "customLighting" => Request::CustomLighting {
            settings: serde_json::from_value(input["settings"].clone()).unwrap(),
            colors: serde_json::from_value(input["colors"].clone()).unwrap(),
        },
        "snapWithKeys" => Request::SnapWithKeys {
            enabled: input["enabled"].as_bool().unwrap(),
            pairs: serde_json::from_value(input["pairs"].clone()).unwrap(),
            keys: serde_json::from_value(input["keys"].clone()).unwrap(),
        },
        "snapTransition" => Request::SnapTransition {
            pairs: serde_json::from_value(input["pairs"].clone()).unwrap(),
            previous: serde_json::from_value(input["previous"].clone()).unwrap(),
        },
        _ => panic!("Unexpected operation"),
    }
}

fn expected_packets(vector: &Vector) -> Vec<Packet> {
    vector
        .packets
        .iter()
        .map(|packet| Packet {
            channel: if packet.channel == "feature" {
                "feature"
            } else {
                "output"
            },
            report_id: packet.report_id,
            data: packet.data.clone(),
        })
        .collect()
}

#[test]
fn packet_encoders_and_response_decoders_match_external_vendor_oracle() {
    let fixture: Fixture = serde_json::from_str(include_str!(
        "../../../tests/fixtures/vendor-protocol-vectors.json"
    ))
    .unwrap();
    let devices = crate::registry::devices().unwrap();
    let mut checked = 0;
    for (index, vector) in fixture.vectors.iter().enumerate() {
        let metadata = devices
            .iter()
            .find(|device| family(&device.router_id) == vector.family)
            .unwrap();
        let mock = MockTransport::default();
        if vector.family == "common" {
            mock.feature.borrow_mut().extend(vector.replies.clone());
            let keyboard = common::Keyboard {
                device: mock,
                product_name: String::new(),
                serial_number: None,
            };
            match request(vector) {
                Request::Lighting(settings) => keyboard.apply_lighting(0, &settings).unwrap(),
                Request::Version => assert_eq!(
                    keyboard.firmware_version().unwrap(),
                    format!("v{}", vector.expected.as_str().unwrap())
                ),
                _ => panic!("Unimplemented Common oracle operation"),
            }
            let events = keyboard.device.events.borrow();
            let actual = events
                .iter()
                .filter_map(|event| match event {
                    Event::Feature(data) => Some(Packet {
                        channel: "feature",
                        report_id: data[0],
                        data: data[1..].to_vec(),
                    }),
                    _ => None,
                })
                .collect::<Vec<_>>();
            assert_eq!(
                actual,
                expected_packets(vector),
                "Common vector {index}: {}",
                vector.input
            );
            checked += 1;
            continue;
        }
        let codec = codec(&metadata.router_id).unwrap();
        match vector.operation.as_str() {
            "decodeLighting" => {
                let data: Vec<u8> = serde_json::from_value(vector.input["data"].clone()).unwrap();
                let actual = match vector.family.as_str() {
                    "witmod" => witmod::decode_lighting(&data),
                    "sparklink" => sparklink::decode_lighting(&data),
                    "hfd_rgb" => hfd_packets::decode_lighting(&data, true),
                    _ => panic!("Missing decoder"),
                }
                .unwrap();
                assert_eq!(actual, vector.expected, "decode vector {index}");
            }
            "decodeVersion" => {
                let data: Vec<u8> = serde_json::from_value(vector.input["data"].clone()).unwrap();
                let actual = if vector.family == "witmod" {
                    witmod::decode_version(&data)
                } else {
                    sparklink::decode_version(&data)
                }
                .unwrap();
                assert_eq!(actual, vector.expected, "version decode vector {index}");
            }
            "macroData" => {
                let events: Vec<MacroEvent> =
                    serde_json::from_value(vector.input["events"].clone()).unwrap();
                let actual = codec.macro_data(2, "oracle", &events).unwrap();
                assert_eq!(
                    serde_json::to_value(actual).unwrap(),
                    vector.expected,
                    "macro vector {index}"
                );
            }
            "decodeMacro" => {
                let data: Vec<u8> = serde_json::from_value(vector.input["data"].clone()).unwrap();
                let replies = data
                    .chunks(if vector.family == "witmod" { 58 } else { 56 })
                    .map(|c| {
                        let mut raw = vec![0; if vector.family == "witmod" { 63 } else { 64 }];
                        let offset = if vector.family == "witmod" { 5 } else { 8 };
                        raw[offset..offset + c.len()].copy_from_slice(c);
                        raw
                    })
                    .collect::<Vec<_>>();
                assert_eq!(
                    codec
                        .decode(&Request::ReadMacro { id: 0 }, &replies, 0)
                        .unwrap(),
                    vector.expected,
                    "macro decode vector {index}"
                );
            }
            _ => {
                let mut model = WireModel {
                    router_id: metadata.router_id.clone(),
                    style_name: metadata.style_name.clone(),
                    led_codes: vec![String::new(); 128],
                    button_defaults: vec![0; 432],
                    key_hids: vec![Some(4); 87],
                    key_codes: vec![String::new(); 87],
                    led_hids: vec![Some(4), Some(5), Some(6), Some(224)],
                };
                if ["customLighting", "snapTransition"].contains(&vector.operation.as_str()) {
                    model.led_codes = vec![String::new(); 4];
                    model.key_hids = vec![Some(4), Some(5), Some(6), Some(224)];
                    model.key_codes = vec![String::new(); 4];
                }
                let request = request(vector);
                if vector.family == "witmod" && matches!(request, Request::WriteKeys { .. }) {
                    model.button_defaults = vec![0; 432];
                }
                let steps = codec.encode(&request, &model).unwrap();
                let mut packets = steps
                    .iter()
                    .filter_map(|step| {
                        if let Step::Send { packet, .. } = step {
                            Some(packet.clone())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>();
                packets.extend(
                    codec
                        .follow_up(&request, &vector.replies[..vector.replies.len().min(1)])
                        .unwrap()
                        .iter()
                        .filter_map(|step| {
                            if let Step::Send { packet, .. } = step {
                                Some(packet.clone())
                            } else {
                                None
                            }
                        }),
                );
                assert_eq!(
                    packets,
                    expected_packets(vector),
                    "packet vector {index} {} {}",
                    vector.family,
                    vector.input
                );
                if ["version", "readMacro", "readLighting"].contains(&vector.operation.as_str())
                    && !vector.expected.is_null()
                {
                    let actual = codec.decode(&request, &vector.replies, 0).unwrap();
                    assert_eq!(actual, vector.expected, "version vector {index}");
                }
            }
        }
        checked += 1;
    }
    assert!(checked >= 1000);
}

#[test]
fn registry_selects_all_seven_drivers_without_opening_a_device() {
    for device in crate::registry::devices().unwrap() {
        let driver = create_with_transport(
            MockTransport::default(),
            device,
            device.product_name.clone(),
            None,
        )
        .unwrap();
        assert!(driver
            .vendor_request(&Request::WriteKeys {
                layer: 255,
                data: Vec::new()
            })
            .is_err());
    }
    assert!(codec("unknown").is_err());
}

#[test]
fn common_mock_preserves_report_ids_errors_and_query_delay() {
    let mock = MockTransport::default();
    mock.feature
        .borrow_mut()
        .push_back(vec![7, 0, 2, 0, 0, 0, 0, 0]);
    let driver = common::Keyboard {
        device: mock,
        product_name: String::new(),
        serial_number: None,
    };
    assert_eq!(driver.current_profile().unwrap(), 1);
    assert!(matches!(
        driver.read_profile_raw(3),
        Err(common::ProtocolError::BadProfile)
    ));
    let events = driver.device.events.borrow();
    assert_eq!(events.len(), 3);
    assert_eq!(events[1], Event::Delay(20));
    assert_eq!(events[2], Event::ReceiveFeature(7));
}

#[test]
fn dpone_reads_detect_offset_once_and_reject_absent_version() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "DponeSeries")
        .unwrap();
    let mock = MockTransport::default();
    let mut version = vec![0; 520];
    version[85] = 39;
    let mut snap = vec![0; 520];
    snap[9] = 1;
    snap[10] = 1;
    snap[11..14].copy_from_slice(&[4, 7, 2]);
    mock.feature
        .borrow_mut()
        .extend([version, snap.clone(), snap]);
    let driver = vendor::Keyboard::new(mock, Box::new(dpone::Driver), metadata).unwrap();
    let expected = serde_json::json!({"enabled":true,"pairs":[{"key1":4,"key2":7,"kind":2}]});
    assert_eq!(driver.execute(&Request::ReadSnap).unwrap(), expected);
    assert_eq!(driver.execute(&Request::ReadSnap).unwrap(), expected);
    let commands = driver
        .transport
        .events
        .borrow()
        .iter()
        .filter_map(|event| match event {
            Event::Feature(data) => Some(data[7]),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(commands, [129, 139, 139]);
    let mock = MockTransport::default();
    mock.feature.borrow_mut().push_back(vec![0; 520]);
    let driver = vendor::Keyboard::new(mock, Box::new(dpone::Driver), metadata).unwrap();
    assert!(driver.execute(&Request::ReadSnap).is_err());
    assert_eq!(
        driver
            .transport
            .events
            .borrow()
            .iter()
            .filter(|event| matches!(event, Event::Feature(_)))
            .count(),
        1
    );
    assert!(dpone::Driver
        .decode(&Request::Version, &[vec![0; 520]], usize::MAX)
        .is_err());
}

#[test]
fn hfd_rgb_skips_only_known_unsolicited_reports_with_a_bound() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "HFDKBRGBSeries")
        .unwrap();
    let mock = MockTransport::default();
    let mut version = vec![0; 64];
    version[..5].copy_from_slice(&[85, 16, 56, 0, 0]);
    version[17] = 2;
    mock.input.borrow_mut().extend([
        vec![85, 250, 7],
        vec![40, 1, 1],
        vec![11, 11],
        vec![11, 14],
        version,
    ]);
    let driver = vendor::Keyboard::new(mock, Box::new(hfd_rgb::Driver), metadata).unwrap();
    assert_eq!(driver.execute(&Request::Version).unwrap(), "2.00");
    assert_eq!(
        driver
            .transport
            .events
            .borrow()
            .iter()
            .filter(|event| matches!(event, Event::Output(_)))
            .count(),
        1
    );
    let mock = MockTransport::default();
    mock.input
        .borrow_mut()
        .extend(std::iter::repeat_n(vec![11, 11], 128));
    let driver = vendor::Keyboard::new(mock, Box::new(hfd_rgb::Driver), metadata).unwrap();
    assert_eq!(
        driver.execute(&Request::Version).unwrap_err(),
        "Too many unsolicited HID reports"
    );
}

#[test]
fn ack_matching_retry_and_numbered_input_reports_are_bounded() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "HFDKBRGBSeries")
        .unwrap();
    let mock = MockTransport::default();
    mock.input.borrow_mut().extend([vec![85, 99, 56, 0, 0], {
        let mut data = vec![0; 64];
        data[..5].copy_from_slice(&[85, 16, 56, 0, 0]);
        data[17] = 2;
        data[16] = 39;
        data
    }]);
    let driver = vendor::Keyboard::new(mock, Box::new(hfd_rgb::Driver), metadata).unwrap();
    assert_eq!(driver.execute(&Request::Version).unwrap(), "2.27");
    let events = driver.transport.events.borrow();
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e, Event::Output(_)))
            .count(),
        2
    );
    assert!(events.contains(&Event::Delay(10)));
    drop(events);
    assert!(driver.execute(&Request::Version).is_err());
}

#[test]
fn numbered_multi_part_replies_reject_wrong_ids_order_and_missing_blocks() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "WitmodSeries")
        .unwrap();
    let payload = b"KEYBOARD,V1_2_3_4";
    let reply = |number: u8| {
        let mut data = vec![0; 64];
        data[0] = 1;
        data[1] = 13;
        data[4] = number;
        if number == 0 {
            data[6..6 + payload.len()].copy_from_slice(payload);
        }
        data
    };
    let mock = MockTransport::default();
    mock.input.borrow_mut().extend([reply(0), reply(1)]);
    let driver = vendor::Keyboard::new(mock, Box::new(witmod::Driver), metadata).unwrap();
    assert_eq!(driver.execute(&Request::Version).unwrap(), "1.2.3");
    for replies in [
        vec![reply(0)],
        vec![reply(1)],
        vec![vec![2, 13, 0, 0, 0, 0]],
    ] {
        let mock = MockTransport::default();
        mock.input.borrow_mut().extend(replies);
        let driver = vendor::Keyboard::new(mock, Box::new(witmod::Driver), metadata).unwrap();
        assert!(driver.execute(&Request::Version).is_err());
    }
}

#[test]
fn tft_version_retries_only_the_vendor_prepare_and_ack_until_acknowledged() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "TFTKeyboardSeries")
        .unwrap();
    let mock = MockTransport::default();
    let empty = vec![0; 65];
    let mut ack = empty.clone();
    ack[4] = 1;
    let mut version = empty.clone();
    version[9] = 7;
    version[10] = 2;
    mock.feature.borrow_mut().extend([
        empty.clone(),
        empty.clone(),
        empty.clone(),
        ack,
        version,
        empty,
    ]);
    let driver = vendor::Keyboard::new(mock, Box::new(tft::Driver), metadata).unwrap();
    assert_eq!(driver.execute(&Request::Version).unwrap(), "2.07");
    let events = driver.transport.events.borrow();
    let commands = events
        .iter()
        .filter_map(|event| match event {
            Event::Feature(data) => Some(data[2]),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(commands, [24, 5, 24, 5, 2]);
}

#[test]
fn malformed_responses_and_unsupported_requests_never_panic_or_write() {
    for metadata in crate::registry::devices()
        .unwrap()
        .iter()
        .filter(|d| d.router_id != "CommonKeyboardSeries")
    {
        let codec = codec(&metadata.router_id).unwrap();
        for length in 0..18 {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                codec.decode(&Request::Version, &[vec![255; length]], 0)
            }));
            assert!(result.is_ok(), "{} length {length}", metadata.router_id);
            assert!(result.unwrap().is_err());
        }
        let mock = MockTransport::default();
        let driver = vendor::Keyboard::new(mock, codec, metadata).unwrap();
        assert!(driver
            .execute(&Request::WriteKeys {
                layer: 255,
                data: vec![0; 512]
            })
            .is_err());
        assert!(driver.transport.events.borrow().is_empty());
    }
    let fake = Box::leak(Box::new(DeviceMetadata {
        id: "unknown".into(),
        product_name: "unknown".into(),
        hardware_name: String::new(),
        model_name: String::new(),
        router_id: "CommonKeyboardSeries".into(),
        style_name: "8440US".into(),
        profiles: 3,
        verified: true,
        connections: Vec::new(),
        capabilities: Default::default(),
    }));
    assert!(create_with_transport(MockTransport::default(), fake, String::new(), None).is_err());
    assert!(!available(fake));
}

#[test]
fn disconnects_and_short_writes_propagate_with_the_vendor_ack_retry_limit() {
    let metadata = crate::registry::devices()
        .unwrap()
        .iter()
        .find(|d| d.router_id == "HFDKBRGBSeries")
        .unwrap();
    let mock = MockTransport::default();
    *mock.fail_next_send.borrow_mut() = Some("Disconnected".into());
    let mut response = vec![0; 64];
    response[..5].copy_from_slice(&[85, 16, 56, 0, 0]);
    mock.input.borrow_mut().push_back(response);
    let driver = vendor::Keyboard::new(mock, Box::new(hfd_rgb::Driver), metadata).unwrap();
    assert!(driver.execute(&Request::Version).is_ok());
    assert_eq!(
        driver
            .transport
            .events
            .borrow()
            .iter()
            .filter(|event| matches!(event, Event::Output(_)))
            .count(),
        2
    );
    let mock = MockTransport::default();
    mock.short_write.set(true);
    let driver = vendor::Keyboard::new(mock, Box::new(hfd_rgb::Driver), metadata).unwrap();
    assert_eq!(
        driver.execute(&Request::Version).unwrap_err(),
        "Short HID write"
    );
    assert_eq!(
        driver
            .transport
            .events
            .borrow()
            .iter()
            .filter(|event| matches!(event, Event::Output(_)))
            .count(),
        2
    );
    let mock = MockTransport::default();
    *mock.fail_next_send.borrow_mut() = Some("Disconnected".into());
    let driver = common::Keyboard {
        device: mock,
        product_name: String::new(),
        serial_number: None,
    };
    assert!(matches!(
        driver.current_profile(),
        Err(common::ProtocolError::Hid(_))
    ));
    assert_eq!(driver.device.events.borrow().len(), 1);
}

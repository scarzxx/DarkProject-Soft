use serde_json::Value;

pub struct Availability(pub bool);

/// Gate plugin initialization on the effective configuration, including CI overrides.
pub fn configured(value: Option<&Value>) -> bool {
    let Some(value) = value.filter(|value| !value.is_null()) else {
        return false;
    };
    match serde_json::from_value::<tauri_plugin_updater::Config>(value.clone()) {
        Ok(config) => !config.pubkey.trim().is_empty() && !config.endpoints.is_empty(),
        Err(error) => {
            eprintln!("Updater disabled: invalid configuration: {error}");
            false
        }
    }
}

/// Tell the frontend whether this build registered the signed updater plugin.
#[tauri::command]
pub fn updater_configured(state: tauri::State<'_, Availability>) -> bool {
    state.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dev_configuration_does_not_initialize_the_updater() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert!(!configured(config.pointer("/plugins/updater")));
        for value in [
            Value::Null,
            json!({}),
            json!({"pubkey":""}),
            json!({"pubkey":"key","endpoints":[]}),
        ] {
            assert!(!configured(Some(&value)));
        }
    }

    #[test]
    fn release_configuration_uses_the_plugin_decoder_and_preserves_install_mode() {
        let config = json!({"pubkey":"test-public-key", "endpoints":["https://example.com/latest.json"],
            "windows":{"installMode":"passive"}});
        assert!(configured(Some(&config)));
        for value in [
            json!({"pubkey":null}),
            json!({"pubkey":"key","endpoints":["invalid-url"]}),
            json!({"pubkey":"key","endpoints":["https://example.com/latest.json"],"windows":{"installMode":"invalid"}}),
        ] {
            assert!(!configured(Some(&value)));
        }
    }
}

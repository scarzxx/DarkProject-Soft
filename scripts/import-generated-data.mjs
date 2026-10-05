import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function usbId(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 65535) {
    throw new Error(`Invalid USB identifier: ${value}`);
  }
  return number;
}

function dimension(value, unit) {
  const trimmed = value?.trim();
  if (!new RegExp(`^\\d*\\.?\\d+${unit}$`).test(trimmed ?? "")) {
    throw new Error(`Invalid ${unit} geometry: ${value}`);
  }
  return trimmed;
}

/** Validate and adapt the four generated vendor tables without executing source. */
export function normalizeGeneratedData(source, compatibility) {
  const inputDevices = source.devices.devices;
  const inputLayouts = source.layouts.layouts;
  const inputProtocols = source.protocols.protocols;
  const inputDefaults = source.defaults.devices;
  const runtimeHash = source.devices.meta.generatedFromRuntimeSha256;
  if (source.defaults.meta.generatedFromRuntimeSha256 !== runtimeHash
    || source.protocols.meta.generatedFromRuntimeSha256 !== runtimeHash
    || source.devices.meta.generatedFromBundleSha256 !== source.layouts.meta.generatedFromBundleSha256) {
    throw new Error("Generated tables come from different vendor sources");
  }
  if (!Array.isArray(inputDevices) || !inputDevices.length
    || new Set(inputDevices.map((device) => device.SN)).size !== inputDevices.length) {
    throw new Error("Missing or duplicate vendor device identities");
  }
  if (compatibility.sourceBundleSha256 !== source.layouts.meta.generatedFromBundleSha256) {
    throw new Error("Layout compatibility metadata comes from a different bundle");
  }
  const devices = inputDevices.map((device) => {
    const family = inputProtocols[device.routerID];
    const defaults = inputDefaults[device.id];
    if (!family?.deviceIds.includes(device.id) || !family.styles.includes(device.styleName)
      || !inputLayouts[device.styleName] || defaults?.deviceData.SN !== device.SN
      || defaults.deviceInfo.StyleName !== device.styleName
      || defaults.deviceData.profile.length !== device.profiles) {
      throw new Error(`Inconsistent device/layout/protocol/defaults: ${device.id}`);
    }
    const connections = device.stateList.filter((state) => state.StateType !== "Bootloader")
      .map((state) => ({ vendorId: usbId(state.vid), productId: usbId(state.pid), transport: state.StateType }));
    if (!connections.length) throw new Error(`No normal connection: ${device.id}`);
    const caps = device.capabilities;
    return {
      id: device.SN, sourceId: device.id, modelName: device.devicename,
      productName: device.productName, hardwareName: device.hardwareName,
      displayName: device.displayName, vendorId: usbId(device.vendorId),
      productId: usbId(device.productId), connections,
      interfaces: device.usageSet.map((item) => ({ usagePage: usbId(item.usagepage),
        usage: usbId(item.usage), transport: item.StateType ?? null })),
      routerId: device.routerID, styleName: device.styleName,
      profiles: device.profiles, fnLayers: device.fnLayers,
      defaultProfile: Math.max(0, Math.min(device.profiles - 1, defaults.deviceData.profileindex - 1)),
      verified: device.SN === "0x342D0xE40F012"
        && device.productName === "DPKB_BUSHIDO_87_ANSI"
        && device.routerID === "CommonKeyboardSeries",
      capabilities: {
        lighting: caps.lighting, customLighting: caps.lighting && caps.lightingEffects.includes(19),
        keybindings: device.modelType === 2, fnLayer: device.fnLayers > 0,
        macros: device.macroMaxRepeatNumber > 0, performance: caps.performance,
        snapTap: caps.snapTap, maxSnapTapPairs: caps.snapTap ? caps.maxSnapTapGroups : 0,
        profiles: device.profiles > 1, lightingEffects: caps.lighting ? caps.lightingEffects : [],
        tft: caps.tft, sync: caps.sync, actuation: caps.actuation,
      },
    };
  });
  const layouts = Object.entries(inputLayouts).sort(([a], [b]) => a.localeCompare(b))
    .map(([styleName, layout]) => {
      const inherited = compatibility.layouts[styleName];
      const mapping = layout.effectiveKeyMapping;
      if (mapping.length !== layout.keys.length || new Set(mapping).size !== mapping.length) {
        throw new Error(`Invalid physical key mapping: ${styleName}`);
      }
      const width = dimension(layout.width ?? inherited?.width, "rem");
      const height = dimension(layout.height ?? inherited?.height, "rem");
      if (parseFloat(width) <= 0 || parseFloat(height) <= 0) {
        throw new Error(`Invalid canvas dimensions: ${styleName}`);
      }
      return {
        styleName, width, height,
        canvasSource: layout.width && layout.height ? "layout" : "embeddedStylesheet",
        mappingSource: layout.keyMappingSource,
        slotMapping: inherited?.slotMapping ?? {},
        keys: layout.keys.map((key, index) => {
          if (key.code !== mapping[index]) throw new Error(`Conflicting key identity: ${styleName}/${index}`);
          const result = { keyMapping: key.code };
          for (const field of ["left", "top", "width", "height"]) {
            result[field] = dimension(key.css[field], "%");
            if (Number.parseFloat(result[field]) !== key[field]
              || (["width", "height"].includes(field) && key[field] <= 0)) {
              throw new Error(`Conflicting geometry: ${styleName}/${index}/${field}`);
            }
          }
          if (key.css.paddingBottom) result.paddingBottom = dimension(key.css.paddingBottom, "%");
          return result;
        }),
      };
    });
  const protocols = Object.entries(inputProtocols).map(([routerId, family]) => {
    const members = devices.filter((device) => device.routerId === routerId);
    if (members.length !== family.deviceCount || members.length !== family.deviceIds.length) {
      throw new Error(`Inconsistent protocol membership: ${routerId}`);
    }
    return { routerId, deviceIds: members.map((device) => device.id), styles: family.styles,
      vendorVerification: family.hardwareVerification };
  });
  const defaults = Object.fromEntries(devices.map((device) => {
    const data = inputDefaults[device.sourceId].deviceData;
    return [device.id, {
      activeProfile: Math.max(0, Math.min(device.profiles - 1, data.profileindex - 1)),
      profiles: data.profile.map((profile) => {
        const lighting = profile.Lighting.find((effect) => effect.value === profile.LightingIndex);
        if (!lighting) throw new Error(`Missing default lighting: ${device.sourceId}`);
        return {
          lighting: { effect: lighting.value, brightness: lighting.BrightnessValue,
            speed: lighting.RateValue, direction: lighting.AngleValue,
            color: lighting.CustomColor[0] ?? [0, 0, 0], multiColor: lighting.MultiColor },
          performance: { pollingRate: profile.Performance.PollingRateValue,
            inputLatency: profile.Performance.InputLatencyValue,
            ...(profile.Performance.DebounceTime !== undefined ? { debounce: profile.Performance.DebounceTime } : {}),
            ...(profile.Performance.SleepTime !== undefined ? { sleepTime: profile.Performance.SleepTime } : {}) },
          snapTapEnabled: profile.SnapTap.flag,
          snapTapPairs: profile.SnapTap.SnapTapData.map((pair) =>
            ({ kind: pair.type, key1: pair.Key1, key2: pair.Key2 })),
          keyBindings: profile.Keybinding.map((binding) =>
            ({ key: binding.value, kind: binding.group, target: binding.function })),
        };
      }),
    }];
  }));
  return { devices, layouts, protocols, defaults };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = new URL("../registry/", import.meta.url);
    const source = {};
    const files = {};
    for (const name of ["devices", "layouts", "protocols", "defaults"]) {
      const content = await readFile(new URL(`generated/${name}.generated.json`, directory), "utf8");
      source[name] = JSON.parse(content);
      files[`${name}.generated.json`] = createHash("sha256").update(content).digest("hex");
    }
    const compatibility = JSON.parse(await readFile(new URL("layout-compatibility.json", directory), "utf8"));
    const result = normalizeGeneratedData(source, compatibility);
    for (const [name, data] of Object.entries(result)) {
      await writeFile(new URL(`${name}.json`, directory), `${JSON.stringify(data, null, 2)}\n`);
    }
    await writeFile(new URL("provenance.json", directory), `${JSON.stringify({
      schemaVersion: 2, source: "DarkProject-generated-data-v1.zip", files,
      sourceSha256: source.layouts.meta.generatedFromBundleSha256,
      runtimeSha256: source.devices.meta.generatedFromRuntimeSha256,
      deviceCount: result.devices.length, layoutCount: result.layouts.length,
      protocolCount: result.protocols.length,
    }, null, 2)}\n`);
    console.log(`Imported ${result.devices.length} devices, ${result.layouts.length} layouts and ${result.protocols.length} protocols.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const DYNAMIC_MAPPING = {
  KD98UK: "0x05AC0x024F002",
  KD98US: "0x05AC0x024F001",
  DPONE87ANSI: "0x1A2C0x1514",
  DPONE87ISO: "0x1A2C0x1513",
};

function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)
        || !ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) {
        throw new Error("Metadata must contain only literal properties");
      }
      return [property.name.text, literal(property.initializer)];
    }));
  }
  if (ts.isPrefixUnaryExpression(node)) {
    const value = literal(node.operand);
    if (node.operator === ts.SyntaxKind.ExclamationToken) return !value;
    if (node.operator === ts.SyntaxKind.MinusToken && typeof value === "number") {
      return -value;
    }
  }
  throw new Error("Executable expressions are not allowed in vendor metadata");
}

function connection(state) {
  return {
    vendorId: Number(state.vid), productId: Number(state.pid),
    transport: state.StateType ?? "USB",
  };
}

/**
 * Extract allowlisted interoperability data using syntax parsing only.
 * @param {string} source Vendor bundle text; it is never executed.
 * @returns {{devices: object[], layouts: object[], sourceSha256: string}}
 * @throws {Error} If literal data or geometry is missing or inconsistent.
 */
export function extractMetadata(source) {
  const tree = ts.createSourceFile(
    "vendor.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS,
  );
  const styles = new Map();
  const matrices = new Map();
  const canvasDefaults = new Map();
  let deviceRecords;
  function visit(node) {
    if (ts.isStringLiteral(node) && node.text.includes(".keyboad-position")) {
      for (const rule of node.text.matchAll(/[^{}]*\.keyboad-position[^{}]*\{([^{}]*)\}/g)) {
        const width = /(?:^|;)\s*width:\s*(\d*\.?\d+rem)\s*(?:;|$)/.exec(rule[1])?.[1];
        const height = /(?:^|;)\s*height:\s*(\d*\.?\d+rem)\s*(?:;|$)/.exec(rule[1])?.[1];
        if (width && height) canvasDefaults.set(`${width}/${height}`, { width, height });
      }
    }
    if (node.name?.text === "AllDevice" && node.initializer) {
      if (deviceRecords) throw new Error("Multiple device registries found");
      deviceRecords = literal(node.initializer);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const fields = node.properties.map((property) => property.name?.text);
      const name = node.parent.name?.text;
      if (name && fields.includes("keyMapping")) styles.set(name, literal(node));
      if (name && fields.includes("Matrix_LEDCode")) {
        matrices.set(name, literal(node));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!Array.isArray(deviceRecords) || !deviceRecords.length) {
    throw new Error("No vendor device registry found");
  }
  const devices = deviceRecords.map((record) => {
    const info = record.deviceInfo;
    const connections = record.StateList
      .filter((state) => state.StateType !== "Bootloader").map(connection);
    if (!connections.length || !styles.has(info.StyleName)) {
      throw new Error(`Missing connection or layout for ${record.devicename}`);
    }
    return {
      id: record.SN,
      productName: record.devicename,
      hardwareName: info.HardwareName,
      displayName: info.DisplayName,
      vendorId: connections[0].vendorId,
      productId: connections[0].productId,
      connections,
      interfaces: record.set.map((item) => ({
        usagePage: Number(item.usagepage), usage: Number(item.usage),
        transport: item.StateType ?? null,
      })),
      routerId: record.routerID,
      styleName: info.StyleName,
      profiles: info.HardwareProfileNum,
      fnLayers: info.FnNums,
      verified: record.devicename === "DPKB_BUSHIDO_87_ANSI"
        && record.routerID === "CommonKeyboardSeries",
      capabilities: {
        lighting: info.LightingFlag === true,
        customLighting: info.LightingFlag === true && info.LightingData.includes(19),
        keybindings: record.ModelType === 2,
        fnLayer: info.FnNums > 0,
        snapTap: info.SnapTapFlag === true,
        macros: info.MacroMaxRepeatNumber > 0,
        performance: info.PerformanceFlag === true,
        profiles: info.HardwareProfileNum > 1,
        maxSnapTapPairs: info.SnapTapFlag ? info.SnapTapMaxGroupNumber : 0,
        lightingEffects: info.LightingFlag ? info.LightingData : [],
        tft: info.TFTFlag === true,
        sync: info.SyncFlag === true,
        actuation: info.Actuation === true,
      },
    };
  });
  const commonStyles = new Set(devices.filter((device) =>
    device.routerId === "CommonKeyboardSeries").map((device) => device.styleName));
  const layouts = [...new Set(devices.map((device) => device.styleName))]
    .sort().map((styleName) => {
      const style = styles.get(styleName);
      const inheritedCanvas = !style.width || !style.height;
      if (inheritedCanvas && canvasDefaults.size !== 1) {
        throw new Error(`Missing or ambiguous vendor canvas dimensions: ${styleName}`);
      }
      const canvas = inheritedCanvas ? canvasDefaults.values().next().value : style;
      const width = style.width ?? canvas.width;
      const height = style.height ?? canvas.height;
      if (![width, height].every((value) => /^\d*\.?\d+rem$/.test(value) && parseFloat(value) > 0)) {
        throw new Error(`Unsupported canvas dimensions: ${styleName}`);
      }
      const mapping = style.keyMapping.length ? style.keyMapping
        : matrices.get(DYNAMIC_MAPPING[styleName])?.Matrix_KEYButtons;
      if (!mapping || mapping.length !== style.ItemCss.length) {
        throw new Error(`Key mapping length does not match geometry: ${styleName}`);
      }
      const matrix = commonStyles.has(styleName) ? matrices.get(
        styleName.endsWith("UK") ? "0x342D0xE40F_UK" : "0x342D0xE40F",
      ) : null;
      const slotMapping = {};
      const physicalKeys = new Set(mapping);
      if (matrix) {
        matrix.Matrix_LEDCode.forEach((key, slot) => {
          if (key && physicalKeys.has(key)) slotMapping[key] = slot;
        });
      }
      return {
        styleName,
        width,
        height,
        canvasSource: inheritedCanvas ? "embeddedStylesheet" : "layout",
        mappingSource: style.keyMapping.length ? "keyMapping"
          : `${DYNAMIC_MAPPING[styleName]}.Matrix_KEYButtons`,
        slotMapping,
        keys: style.ItemCss.map((position, index) => {
          const result = { keyMapping: mapping[index] };
          for (const field of ["left", "top", "width", "height"]) {
            const value = position[field]?.trim();
            if (!/^\d*\.?\d+%$/.test(value ?? "")) {
              throw new Error(`Unsupported geometry ${styleName}/${index}/${field}`);
            }
            result[field] = value;
          }
          if (position.paddingBottom) result.paddingBottom = position.paddingBottom.trim();
          return result;
        }),
      };
    });
  return {
    devices, layouts,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const path = process.argv[2];
    if (!path) throw new Error("Usage: node scripts/extract-vendor-metadata.mjs <bundle>");
    const result = extractMetadata(await readFile(path, "utf8"));
    const target = new URL("../registry/bundle-extraction/", import.meta.url);
    await mkdir(target, { recursive: true });
    for (const name of ["devices", "layouts"]) {
      await writeFile(new URL(`${name}.json`, target), `${JSON.stringify(result[name], null, 2)}\n`);
    }
    await writeFile(new URL("provenance.json", target), `${JSON.stringify({
      schemaVersion: 1,
      sourceSha256: result.sourceSha256,
      deviceCount: result.devices.length,
      layoutCount: result.layouts.length,
    }, null, 2)}\n`);
    console.log(`Extracted ${result.devices.length} devices and ${result.layouts.length} layouts.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

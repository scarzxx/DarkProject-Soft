import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const SOURCE_SHA = "92e38419a4f30f24fb09dbd9dc5da91f2ed637682dc48a65ef2689448d405b46";
const FAMILIES = {
  common: "Ie", dpone: "fe", witmod: "Qe", tft: "oe",
  sparklink: "Ue", hfd: "G", hfd_rgb: "q",
};
const METHODS = new Set([
  "CombineData", "formatBuffer", "ApplyLighting", "getProfleData",
  "getDeviceVersions", "getLightingCommand", "getLightingData",
  "StartSetting2Device", "FinishSetting2Device", "ApplySnapTap",
  "ApplySnapTapStatus", "getSnapTapStatus", "MacroToData",
  "SetMacroDataToDevice", "SetMacroKeyToDevice", "SendNormalButtons",
  "SendFNButtons", "HidtoLightingData", "HidtoVersionData",
  "HidtoSnapStatusData", "getGamemodeCommand", "getNormalKeyCommand",
  "getFNKeyCommand", "getMacroCommand", "getMacroInitCommand",
  "setFeatureReoport", "getFeatureReoport", "setOutputReport", "setReport",
  "TranslateMacroContent",
  "SendCustomLighting", "setCustomLightAssignToData",
  "CoverSnapTapData", "DeleteAdvanceKey",
  "getMacroData", "HidtoMacroData", "parseBuffer",
  "SendTimeSyns2Device", "ApplyTimeSyns",
]);

/** Execute only audited packet methods of the fingerprinted, external bundle.
 * No source is saved: the artifact contains technical data and test vectors.
 * @param {string} source Bundle contents.
 * @returns {Promise<object>} Deterministic byte vectors from vendor methods.
 * @throws {Error} For a different bundle or any unexpected vendor failure.
 */
export async function generateVectors(source) {
  const sha256 = createHash("sha256").update(source).digest("hex");
  if (sha256 !== SOURCE_SHA) throw new Error("Unaudited vendor bundle fingerprint");
  const tree = ts.createSourceFile("vendor.js", source, 99, true, ts.ScriptKind.JS);
  const printer = ts.createPrinter();
  const classes = new Map();
  const matrices = new Map();
  let functionMapping;
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.pos > 1562410 && node.end < 1791123) {
      let ancestor = node.parent;
      while (ancestor && !ts.isVariableDeclaration(ancestor)) ancestor = ancestor.parent;
      if (ancestor) classes.set(ancestor.name.getText(tree), node);
      if (node.name && node.name.text !== "Oe") classes.set(node.name.text, node);
    }
    if (ts.isObjectLiteralExpression(node) && node.properties.some(p => p.name?.text === "Matrix_LEDCode")) {
      matrices.set(node.parent.name?.text, node);
    }
    if (node.name?.text === "AllFunctionMapping" && node.initializer) functionMapping = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const mapping = [4, 5, 6, 224].map((hid, i) => ({
    hid, keyCode: 65 + i, code: `Key${String.fromCharCode(65 + i)}`,
    value: `key-${hid}`, functionType: "Singlekey",
  }));
  const context = vm.createContext({
    Date: class {
      getFullYear(){return 2026;} getMonth(){return 9;} getDate(){return 4;}
      getHours(){return 12;} getMinutes(){return 34;} getSeconds(){return 56;} getDay(){return 0;}
    },
    TextEncoder, TextDecoder, console: { log() {}, error(message) { throw new Error(message); } },
    f: { A: (generator) => function (...args) {
      const iterator = generator.apply(this, args);
      const step = (kind, value) => {
        const next = iterator[kind](value);
        return next.done ? Promise.resolve(next.value)
          : Promise.resolve(next.value).then(v => step("next", v), e => step("throw", e));
      };
      return step("next");
    } },
    k: { cloneDeep: structuredClone },
  }, { codeGeneration: { strings: false, wasm: false } });
  const printClass = (name, node, helper = false) => {
    if (!node) throw new Error(`Missing class ${name}`);
    const members = node.members.filter(member => {
      if (member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)) return false;
      if (ts.isConstructorDeclaration(member)) return false;
      if (helper) return true;
      return METHODS.has(member.name?.getText(tree))
        || ["LEDType", "FeatureId", "bufferLength", "GetOffset"].includes(member.name?.getText(tree));
    });
    return `class ${name} { ${members.map(m => printer.printNode(4, m, tree)).join("\n")} }`;
  };
  new vm.Script(["_e", "Ke", "Ye"].map(name => printClass(name, classes.get(name), true))
    .concat([...Object.values(FAMILIES), "Fe"].map(name => printClass(name, classes.get(name))))
    .join("\n")).runInContext(context, { timeout: 1000 });
  const vectors = [];
  const effects = {};
  for (const [family, name] of Object.entries(FAMILIES)) {
    const driver = new vm.Script(`new ${name}()`).runInContext(context, { timeout: 1000 });
    effects[family] = JSON.parse(JSON.stringify(driver.LEDType));
    const feature = new vm.Script("new Fe()").runInContext(context);
    let packets = [], responses = [], sleeps = [];
    feature.delay = async ms => { sleeps.push(ms); };
    const device = {
      Delaytime: { common: 20, dpone: 50, witmod: 10, tft: 35, sparklink: 10, hfd: 35, hfd_rgb: 35 }[family],
      async sendFeatureReport(reportId, data) { packets.push({ channel: "feature", reportId, data: Array.from(data) }); },
      async sendReport(reportId, data) { packets.push({ channel: "output", reportId, data: Array.from(data) }); },
      async receiveFeatureReport() {
        const response = responses.shift();
        if (!response) throw new Error("Unexpected feature receive");
        return new DataView(Uint8Array.from(response).buffer);
      },
    };
    Object.assign(driver, {
      FeatureReport: feature,
      CommonService: { convertToLevel: value => value <= 0 ? 1 : value <= 25 ? 2
        : value <= 50 ? 3 : value <= 75 ? 4 : 5 },
      SupportDataClass: { getAllFunctionMapping: () => mapping },
      KeyboardLocation: { getLedCode: () => mapping.map(m => m.code), getMatrix_KEYButtons: () => mapping.map(m => m.code),
        GMMKLocation: { keyBoardList: { oracle:{ Matrix_LEDCode:mapping.map(m => m.code) } } } },
      DeviceService: { getCurrentDeviceProfile: () => ({ Performance: { DebounceTime: 9 } }), updateSnapTap() {} },
      loggingService: { logInfo() {}, logError(message) { throw new Error(message); } },
      GetOffset: 0, MacroTempData: [],
      arrayToHexString: () => "",
      async sendWithAckRetry(dev, id, data, expected) {
        await dev.sendReport(id, data);
        const reply = responses.shift() ?? [...expected, ...Array(64 - expected.length).fill(0)];
        if (!expected.every((byte, i) => byte === reply[i])) throw new Error("Oracle ACK mismatch");
        return Uint8Array.from(reply);
      },
      toSingleResponse: response => response,
      handleKeybindingData() {}, handleMacroData() {},
    });
    async function record(operation, input, invoke, replies = []) {
      packets = []; responses = replies.map(r => [...r]); sleeps = [];
      const expected = await invoke();
      if (responses.length) throw new Error(`Unused responses in ${family}/${operation}`);
      vectors.push({ family, operation, input, packets, replies, sleeps,
        expected: expected == null ? null : JSON.parse(JSON.stringify(expected)) });
    }
    const model = { SN: "oracle", version_Wired: "", deviceData: { profile: [] } };
    if(["dpone", "tft"].includes(family)) {
      for(const enabled of [true,false])await record("clock",{enabled,year:2026,month:10,day:4,hour:12,minute:34,second:56,weekday:0},
        ()=>driver.ApplyTimeSyns(device,enabled?1:0), Array.from({length:3},()=>Array(65).fill(0)));
    }
    if (["dpone", "witmod", "sparklink", "hfd_rgb"].includes(family)) {
      const colors = [{ slot: 0, color: [255,0,7] }, { slot: 3, color: [0,17,241] }];
      const settings = { effect:19, brightness:70, speed:25, direction:0, color:[17,83,241], multiColor:true };
      const vendorColors = colors.map(p => ({ value:mapping[p.slot].code, color:[...p.color,1] }));
      await record("customLighting", { settings,colors }, () => driver.ApplyLighting(device,model,0,{
        value:19, BrightnessValue:70, RateValue:25, AngleValue:0, CustomColor:[settings.color],
        MultiColor:true, CustomIndex:0, KeyMappingColor:[{ data:vendorColors }],
      }));
    }
    const versionReply = Array(520).fill(0);
    versionReply[14] = 1; versionReply[15] = 39;
    versionReply[16] = 39; versionReply[17] = 2; versionReply[84] = 39;
    const tftAck = Array(65).fill(0); tftAck[4] = 1;
    const tftVersion = Array(65).fill(0); tftVersion[9] = 7; tftVersion[10] = 2;
    const rgbVersion = Array(64).fill(0); rgbVersion.splice(0, 5, 85, 16, 56, 0, 0);
    rgbVersion[16] = 39; rgbVersion[17] = 2;
    await record("version", {}, async () => {
      await driver.getDeviceVersions(device, model);
      return model.version_Wired || null;
    }, family === "common" ? [versionReply.slice(0,264)] : family === "dpone" ? [versionReply]
      : family === "tft" ? [Array(65).fill(0), tftAck, tftVersion, Array(65).fill(0)]
      : family === "hfd_rgb" ? [rgbVersion] : []);
    if (family === "witmod" || family === "sparklink") {
      const text = family === "witmod" ? "KEYBOARD,V1_2_3_4" : "App V1.2.3TENDT";
      const data = Array(116).fill(0); data.splice(0, text.length, ...new TextEncoder().encode(text));
      await record("decodeVersion", { data }, async () => {
        await driver.HidtoVersionData(model, Uint8Array.from(data));
        return model.version_Wired;
      });
    }
    if (["dpone","hfd","tft"].includes(family)) {
      const profile={LightingIndex:0,Lighting:Array.from({length:61},(_,value)=>({
        value,BrightnessValue:0,RateValue:0,AngleValue:0,MultiColor:false,CustomColor:[],
      }))};
      const selected=Array(520).fill(0);selected[9]=1;
      const data=Array(family === "dpone" ? 520 : 65).fill(0);
      if (family === "dpone") {data[8]=95;data[10]=146;data.splice(11,3,17,83,241);}
      else {data[1]=5;data.splice(2,3,17,83,241);data[9]=1;data[10]=3;data[11]=2;data[15]=170;data[16]=85;}
      await record("readLighting",{},async()=>{
        if(family === "dpone")await driver.getLightingData(device,model,0,profile);
        else await driver.getLightingData(device,model,profile);
        const effect=profile.LightingIndex,setting=profile.Lighting[effect];
        return {effect,brightness:setting.BrightnessValue,speed:setting.RateValue,direction:setting.AngleValue,
          multiColor:setting.MultiColor,color:setting.CustomColor[0]??null};
      },family === "dpone" ? [selected,data] : family === "tft" ? [Array(65).fill(0),data] : [data]);
    }
    for (const entry of driver.LEDType.filter(e => e.EffectID !== 19)) {
      const directions = entry.DirType === "Four" ? [0, 1, 2, 3]
        : entry.DirType ? [0, 1] : [0];
      for (const direction of directions) for (const level of [0, 1, 25, 70, 99, 100]) {
        const input = { effect: entry.EffectID, brightness: level, speed: level,
          direction, color: [17, 83, 241], multiColor: level % 2 === 1 };
        const lighting = { value: input.effect, BrightnessValue: level, RateValue: level,
          AngleValue: family === "common" && input.effect === 1 ? 1 - direction : direction,
          CustomColor: [input.color], MultiColor: input.multiColor,
          CustomIndex: 0 };
        const raw = Array(257).fill(0); raw[0] = 7; raw[2] = 1; raw[86] = 9;
        raw[83] = input.effect === 7 ? 0 : 8;
        await record("lighting", input, () => driver.ApplyLighting(device, { SN: "oracle" }, 0, lighting),
          family === "common" ? [raw] : family === "tft" ? Array(4).fill(Array(65).fill(0)) : []);
      }
    }
    if (family !== "common") {
      for (const layer of [0, 1]) {
        const length = family === "tft" ? 576 : family === "witmod" ? 432 : family === "sparklink" ? 116 : 512;
        const data = Array.from({ length }, (_, i) => i % 251);
        driver.KeyAssignToData = () => Uint8Array.from(data);
        await record("writeKeys", { layer, data }, () => layer === 0
          ? driver.SendNormalButtons(device, model, [{}], [])
          : driver.SendFNButtons(device, model, [{}], 1),
        family === "tft" || family === "dpone" && layer === 1 ? Array(3).fill(Array(65).fill(0)) : []);
      }
    }
    if (["dpone", "witmod", "sparklink", "hfd_rgb"].includes(family)) {
      for (const entry of driver.LEDType.filter(e => e.EffectID !== 19)) {
        const profile = { LightingIndex: 0, Lighting: driver.LEDType.map(e => ({
          value: e.EffectID, BrightnessValue: 0, RateValue: 0, AngleValue: 0,
          MultiColor: false, CustomColor: [],
        })) };
        const data = Array(family === "witmod" ? 63 : 60).fill(0);
        if (family === "dpone") continue;
        if (family === "witmod") {
          data[0] = 7; data[4] = 12; data[5] = entry.HidEffectID;
          data[6] = 3; data[7] = 2; data[8] = 17; data[9] = 83; data[10] = 241;
          data[14] = entry.DirType === "Updown" ? 2 : 0; data[15] = 1;
        } else if (family === "sparklink") {
          data[37] = 1; data[38] = 3; data[39] = entry.HidEffectID;
          data[40] = 2; data[42] = 7; data[5] = 241; data[6] = 83; data[7] = 17;
        } else {
          data[0] = entry.HidEffectID; data[9] = 3; data[10] = 2; data[8] = 1;
          data[1] = 241; data[2] = 83; data[3] = 17;
        }
        await record("decodeLighting", { data }, async () => {
          await driver.HidtoLightingData(device, Uint8Array.from(data), profile);
          const effect = family === "witmod"
            ? profile.Lighting[profile.LightingIndex].value : profile.LightingIndex;
          const setting = profile.Lighting.find(e => e.value === effect);
          return { effect, brightness: setting.BrightnessValue, speed: setting.RateValue,
            direction: setting.AngleValue, multiColor: setting.MultiColor,
            color: setting.CustomColor[0] ?? null };
        });
      }
    }
    if (["dpone", "witmod"].includes(family)) {
      for (const count of [0, 1, 20]) {
        const pairs = Array.from({ length: count }, (_, i) => ({ kind: i % 3, key1: 4, key2: 5 }));
        const input = { enabled: count > 0, pairs };
        await record("snap", input, () => driver.ApplySnapTap(device, { SN: "oracle" }, 0,
          { SnapTapStatus: input.enabled, SnapTapData: pairs.map(p => ({
            Key1: "KeyA", Key2: "KeyB", type: p.kind,
          })) }), family === "dpone" ? [Array(520).fill(0)] : []);
      }
    }
    if (["hfd", "hfd_rgb"].includes(family)) {
      for (const kind of [0,1,2,3]) {
        const keys = Array.from({length:512},(_,i)=>i%251);
        driver.KeyAssignToData = () => Uint8Array.from(keys);
        await record("snapWithKeys", {enabled:true,keys,pairs:[{kind,key1:4,key2:5}]}, () =>
          driver.ApplySnapTap(device,model,0,{ SnapTapStatus:true,Keybinding:[{}],
            SnapTapData:[{type:kind,Key1:"KeyA",Key2:"KeyB"}] }));
      }
    }
    if (family === "sparklink") {
      const previous = [{kind:0,key1:5,key2:6}], pairs = [{kind:0,key1:4,key2:224}];
      device.TempProfile = { Keybinding:[], SnapTap:{SnapTapData:[{type:0,Key1:"KeyB",Key2:"KeyC"}]} };
      await record("snapTransition", {previous,pairs}, () => driver.ApplySnapTap(device,model,0,
        {SnapTapStatus:true,SnapTapData:[{type:0,Key1:"KeyA",Key2:"KeyD"}]}));
    }
    if (family === "dpone" || family === "witmod" || family === "hfd_rgb") {
      const data = Array(family === "dpone" ? 520 : family === "witmod" ? 256 : 3072).fill(0);
      if (family === "dpone") {
        data.splice(8,6,...new TextEncoder().encode("oracle")); data[46]=1; data[47]=2;
        data.splice(48,6,4,244,129,5,244,1);
      } else if (family === "witmod") {
        data[3]=8; data.splice(8,8,4,16,129,244,5,0,1,244);
      } else {
        data.splice(400,12,4,0,0,0,244,1,4,176,244,1,5,48);
      }
      driver.MacroTempData=[];
      await record(family === "dpone" ? "readMacro" : "decodeMacro", {id:2,data}, async () => {
        if (family === "dpone") await driver.getMacroData(device,2);
        else if (family === "witmod") await driver.HidtoMacroData(device,Uint8Array.from(data),2);
        else driver.parseBuffer(Uint8Array.from(data));
        const macros=driver.MacroTempData;
        const events=macros[0].content.map(e=>({hid:mapping.find(m=>m.keyCode===e.keycode).hid,delay:e.delayTime,pressed:e.updown===0}));
        return family === "dpone" ? { name:macros[0].name,repeat:1,events }
          : family === "witmod" ? {events,repeatType:0,repeatTime:0} : [events];
      },family === "dpone" ? [data] : []);
    }
    for (const count of typeof driver.MacroToData === "function"
      ? family === "sparklink" ? [1,2,14,15,20,56,57,64] : [1, 2, 14, 15, 20] : []) {
      const events = Array.from({ length: count }, (_, i) => ({ hid: mapping[i % 3].hid,
        delay: i * 157, pressed: i % 2 === 0 }));
      const macro = { name: "oracle", value: 3, RepeatType: 0, RepeatTime: 1,
          content: events.map(e => ({ name: `key-${e.hid}`, keycode: mapping.find(m => m.hid === e.hid).keyCode,
            delayTime: e.delay, updown: e.pressed ? 0 : 1, type: 2 })),
        };
      const data = Array.from(driver.MacroToData(macro), value => Number(value ?? 0) & 255);
      await record("macroData", { events, id: 2, name: "oracle" }, () => data);
      if (family === "dpone") {
        await record("writeMacro", { events, id: 2, name: "oracle" }, () =>
          driver.SetMacroDataToDevice(device, [{ MacroID: 2, MacroData: data }]));
      } else if (family === "sparklink") {
        await record("boundMacro", { events, key: 4 }, () => driver.SetMacroDataToDevice(device,
          [{ MacroID: 1, Keyvalue: "KeyA", contentCount: count, MacroData: data }], model));
      } else {
        const header = Array(400).fill(0); header[0] = 144; header[1] = 1;
        const denseData = Array.from(driver.MacroToData({ ...macro, value: 1 }), value => Number(value ?? 0) & 255);
        await record("macroTable", { macros: [{ id: 0, name: "oracle", events }] }, () =>
          driver.SetMacroDataToDevice(device, family === "witmod" ? [{ MacroID: 1, MacroData: denseData }]
            : [...header, ...denseData]), family === "tft" ? Array(2).fill(Array(65).fill(0)) : []);
      }
    }
  }
  const devices = JSON.parse(await readFile("registry/devices.json", "utf8"));
  const wireModels = {};
  const functions = new vm.Script(`(${printer.printNode(4, functionMapping, tree)})`)
    .runInContext(context, { timeout: 1000 });
  for (const device of devices) {
    const suffix = device.routerId === "WitmodSeries" && device.hardwareName.includes("GK8110") ? "_87" : "";
    const key = device.id.slice(0, device.id.lastIndexOf("0x") + 6) + suffix;
    const matrixNode = ["TFTKeyboardSeries", "HFDKBSeries"].includes(device.routerId)
      ? matrices.get(device.id) : matrices.get(key);
    const raw = matrixNode ? new vm.Script(`(${printer.printNode(4, matrixNode, tree)})`)
      .runInContext(context, { timeout: 1000 }) : {};
    wireModels[device.id] = { routerId: device.routerId, styleName: device.styleName,
      ledCodes: Array.from(raw.Matrix_LEDCode ?? []), buttonDefaults: Array.from(raw.Buttoninfo_Default ?? []),
      keyCodes: Array.from(raw.Matrix_KEYButtons ?? []),
      ledHids: Array.from(raw.Matrix_LEDCode ?? []).map(code => functions.find(f => f.code === code)?.hid ?? null),
      keyHids: Array.from(raw.Matrix_KEYButtons ?? []).map(code => functions.find(f => f.code === code)?.hid ?? null) };
  }
  return { sourceSha256: sha256, responseOrigin: "synthetic; vendor methods are the oracle", effects, vectors,
    wireModels };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/vendor-protocol-oracle.mjs <external main.js>");
  const output = await generateVectors(await readFile(input, "utf8"));
  const { wireModels, ...fixture } = output;
  await writeFile("registry/protocol-wire.json", `${JSON.stringify({sourceSha256:output.sourceSha256,models:wireModels}, null, 2)}\n`);
  await writeFile("tests/fixtures/vendor-protocol-vectors.json", `${JSON.stringify(fixture)}\n`);
  console.log(`Generated ${output.vectors.length} vendor vectors`);
}

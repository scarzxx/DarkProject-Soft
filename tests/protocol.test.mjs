import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateVectors } from "../scripts/vendor-protocol-oracle.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/vendor-protocol-vectors.json",import.meta.url),"utf8"));
const wire = JSON.parse(await readFile(new URL("../registry/protocol-wire.json",import.meta.url),"utf8"));
const devices = JSON.parse(await readFile(new URL("../registry/devices.json",import.meta.url),"utf8"));

test("golden vectors are technical bytes for seven families with explicit synthetic provenance",()=>{
  assert.equal(fixture.vectors.length,1059);
  assert.equal(fixture.sourceSha256,wire.sourceSha256);
  assert.match(fixture.responseOrigin,/synthetic/);
  assert.deepEqual(new Set(fixture.vectors.map(v=>v.family)),new Set(["common","dpone","witmod","tft","sparklink","hfd","hfd_rgb"]));
  for(const vector of fixture.vectors)for(const packet of vector.packets){
    assert.ok(["feature","output"].includes(packet.channel));
    assert.ok([0,1,7].includes(packet.reportId));
    assert.ok(packet.data.length>0 && packet.data.length<=520);
    assert.ok(packet.data.every(value=>Number.isInteger(value) && value>=0 && value<=255));
  }
});

test("packet matrices preserve each canonical model and do not invent missing ALU85A slots",()=>{
  assert.equal(Object.keys(wire.models).length,devices.length);
  for(const device of devices){
    const model=wire.models[device.id];
    assert.equal(model.routerId,device.routerId);
    assert.equal(model.styleName,device.styleName);
    assert.equal(model.ledCodes.length,model.ledHids.length);
    assert.equal(model.keyCodes.length,model.keyHids.length);
  }
  const alu=devices.find(device=>device.modelName==="ALU85A");
  assert.deepEqual(wire.models[alu.id].ledCodes,[]);
  assert.deepEqual(wire.models[alu.id].buttonDefaults,[]);
});

test("oracle rejects executable input whose fingerprint was not audited",async()=>{
  await assert.rejects(generateVectors("globalThis.executed = true"),/Unaudited vendor bundle/);
});

test("external vendor execution reproduces every checked-in byte vector and model matrix",async t=>{
  let source;
  try {source=await readFile("C:/Users/scarz/Desktop/main.67f2a4ad434666c9.js","utf8");}
  catch(error){if(error.code!=="ENOENT")throw error;t.skip("External proprietary bundle is deliberately absent from the repository");return;}
  const {wireModels,...generated}=await generateVectors(source);
  const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(hash(generated),hash(fixture),"Complete vendor vector artifact differs");
  assert.equal(hash(wireModels),hash(wire.models),"Vendor model matrices differ");
});

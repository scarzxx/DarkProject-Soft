import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2]?.trim().replace(/^v/, "");
if (!raw || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(raw)) {
  console.error("Usage: npm run release:version -- 0.4.1");
  process.exit(1);
}

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, value) => fs.writeFileSync(path.join(root, file), value, "utf8");

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.version = raw;
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriPath = "src-tauri/tauri.conf.json";
const tauriConfig = JSON.parse(read(tauriPath));
tauriConfig.version = raw;
write(tauriPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoPath = "src-tauri/Cargo.toml";
const cargo = read(cargoPath).replace(
  /^(\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m,
  `$1${raw}$2`,
);
write(cargoPath, cargo);

const appPath = "src/App.tsx";
let app = read(appPath);
app = app.replace(/<small>v[^<]+<\/small>/, `<small>v${raw}</small>`);
write(appPath, app);

const updaterPath = "src/lib/updater.ts";
let updater = read(updaterPath);
updater = updater.replace(/return "\d+\.\d+\.\d+(?:-[^"]+)?";/g, `return "${raw}";`);
write(updaterPath, updater);

console.log(`Dark Control version updated to ${raw}.`);
console.log(`Next: npm install, commit the version bump, then create and push tag v${raw}.`);

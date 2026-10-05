import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, value) => fs.writeFileSync(path.join(root, file), value, "utf8");

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
const requested = process.argv[2]?.trim().replace(/^v/, "");
const raw = requested || String(packageJson.version || "").trim();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(raw)) {
  console.error("Version must look like 0.4.2 or 0.4.2-beta.1.");
  process.exit(1);
}

// package.json is the single version the user edits in VS Code.
packageJson.version = raw;
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const lockPath = "package-lock.json";
if (fs.existsSync(path.join(root, lockPath))) {
  const lock = JSON.parse(read(lockPath));
  lock.version = raw;
  if (lock.packages?.[""]) lock.packages[""].version = raw;
  write(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

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

const preferencesPath = "src/components/PreferencesOverlay.tsx";
let preferences = read(preferencesPath);
preferences = preferences.replace(
  /const \[appVersion, setAppVersion\] = useState\("[^"]+"\);/,
  `const [appVersion, setAppVersion] = useState("${raw}");`,
);
write(preferencesPath, preferences);

console.log(`Dark Control version synchronized to ${raw}.`);
if (requested) console.log("package.json was updated too.");

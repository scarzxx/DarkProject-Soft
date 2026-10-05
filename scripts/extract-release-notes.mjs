import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requested = process.argv[2]?.trim().replace(/^v/i, "");
const outputPath = process.argv[3] || "release-notes.md";

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = requested || String(packageJson.version || "").trim();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid release version: ${version}`);
  process.exit(1);
}

const changelogPath = path.join(root, "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
  console.error("CHANGELOG.md is missing.");
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, "utf8");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^##\\s+(?:\\[)?v?${escaped}(?:\\])?(?:\\s+-\\s+.*)?\\s*$`, "mi");
const match = heading.exec(changelog);

if (!match) {
  console.error(`CHANGELOG.md does not contain a section for ${version}.`);
  console.error(`Add:\n\n## ${version}\n\n- Popis změny.`);
  process.exit(1);
}

const afterHeading = changelog.slice(match.index + match[0].length);
const nextHeading = afterHeading.search(/^##\s+/m);
const body = (nextHeading >= 0 ? afterHeading.slice(0, nextHeading) : afterHeading).trim();

if (!body) {
  console.error(`CHANGELOG.md section ${version} is empty.`);
  process.exit(1);
}

fs.writeFileSync(path.resolve(root, outputPath), `${body}\n`, "utf8");
console.log(`Release notes for ${version} written to ${outputPath}.`);

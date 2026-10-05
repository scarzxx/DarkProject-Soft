import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

export const AUTO_UPDATE_KEY = "dark-control.auto-updates";
export const AUTO_CHECK_SESSION_KEY = "dark-control.update.auto-checked";

const RELEASES_API = "https://api.github.com/repos/scarzxx/DarkProject-Soft/releases/latest";

export type Update = {
  version: string;
  body: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  downloadUrl: string;
  assetName: string;
  assetSize: number;
};

type GitHubAsset = {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
};

type GitHubRelease = {
  tag_name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
};

export const supportsUpdater = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let inFlightCheck: Promise<Update | null> | null = null;

export async function getAppVersion(): Promise<string> {
  if (!supportsUpdater()) return "0.4.0";
  try {
    return await getVersion();
  } catch {
    return "0.4.0";
  }
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function versionParts(version: string) {
  const [core, prerelease = ""] = normalizeVersion(version).split("-", 2);
  const numbers = core.split(".").map((part) => Number.parseInt(part, 10));
  return {
    numbers: [numbers[0] || 0, numbers[1] || 0, numbers[2] || 0],
    prerelease,
  };
}

/** Compare release versions without adding another runtime dependency. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = versionParts(candidate);
  const b = versionParts(current);
  for (let i = 0; i < 3; i += 1) {
    if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i];
  }
  if (a.prerelease === b.prerelease) return false;
  if (!a.prerelease) return true;
  if (!b.prerelease) return false;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true }) > 0;
}

function installerFromRelease(release: GitHubRelease): GitHubAsset | null {
  const assets = Array.isArray(release.assets) ? release.assets as GitHubAsset[] : [];
  const usable = assets.filter((asset) =>
    typeof asset.name === "string" && typeof asset.browser_download_url === "string");
  return usable.find((asset) => /windows-x64-setup\.exe$/i.test(String(asset.name)))
    ?? usable.find((asset) => /_x64-setup\.exe$/i.test(String(asset.name)))
    ?? usable.find((asset) => /setup\.exe$/i.test(String(asset.name)))
    ?? null;
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASES_API, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) {
    throw new Error("GitHub Releases are not publicly available yet.");
  }
  if (!response.ok) {
    throw new Error(`GitHub Releases returned HTTP ${response.status}.`);
  }
  return await response.json() as GitHubRelease;
}

/** Check the repository's latest public GitHub Release and select its Windows installer. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!supportsUpdater()) return null;
  if (!inFlightCheck) {
    inFlightCheck = (async () => {
      const [release, currentVersion] = await Promise.all([fetchLatestRelease(), getAppVersion()]);
      if (release.draft || release.prerelease || typeof release.tag_name !== "string") return null;
      const version = normalizeVersion(release.tag_name);
      if (!isNewerVersion(version, currentVersion)) return null;
      const installer = installerFromRelease(release);
      if (!installer) throw new Error("The latest GitHub Release does not contain a Windows setup EXE.");
      return {
        version,
        body: typeof release.body === "string" ? release.body : null,
        publishedAt: typeof release.published_at === "string" ? release.published_at : null,
        releaseUrl: typeof release.html_url === "string" ? release.html_url : "https://github.com/scarzxx/DarkProject-Soft/releases",
        downloadUrl: String(installer.browser_download_url),
        assetName: String(installer.name),
        assetSize: typeof installer.size === "number" ? installer.size : 0,
      } satisfies Update;
    })().finally(() => {
      inFlightCheck = null;
    });
  }
  return inFlightCheck;
}

/** Download the selected public GitHub Release installer and launch it on Windows. */
export async function installGitHubUpdate(update: Update): Promise<void> {
  if (!supportsUpdater()) throw new Error("Updates are available only in the desktop app.");
  await invoke("install_github_release", {
    url: update.downloadUrl,
    fileName: update.assetName,
  });
}

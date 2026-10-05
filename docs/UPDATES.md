# Dark Control updates and Windows releases

Dark Control uses normal public **GitHub Releases** as its update source. It does not require Tauri updater signing keys, `latest.json`, `.sig` files, or a separate update server.

## What users get

- Settings contains an **Updates** section with the installed app version.
- Automatic checks are enabled by default and can be disabled in Settings.
- A startup check stays silent when no newer release exists or when GitHub is unavailable.
- Manual **Check for updates** reports the result or an error.
- When a newer release exists, Dark Control shows the GitHub release notes and current/new version.
- **Download and install** downloads the Windows setup EXE directly from this repository's GitHub Release, launches it, then closes Dark Control so the installer can update the app.
- The native command accepts download URLs only from `scarzxx/DarkProject-Soft/releases/download/` and only launches an EXE asset.

There are no updater key secrets to create or remember.

## Public releases

The in-app checker reads:

```text
https://api.github.com/repos/scarzxx/DarkProject-Soft/releases/latest
```

GitHub's `latest` endpoint only works anonymously for a public repository/release. While this repository remains private, automatic and manual checks cannot access releases without credentials. Dark Control intentionally does not embed a GitHub token in the application.

Once the repository is public, no additional updater configuration is needed.

## CI artifacts from `main`

Every successful push to `main` builds and uploads the workflow artifact `Dark-Control-Windows-x64` containing:

- `dark-control.exe`
- the WiX/MSI installer
- the NSIS setup EXE

These Actions artifacts are for development/testing. The installed app checks **GitHub Releases**, not workflow artifacts.

## Publishing a release

Keep all application versions synchronized with:

```powershell
npm run release:version -- 0.4.1
npm install
```

Commit the version bump, then create and push the matching tag:

```powershell
git add .
git commit -m "release: v0.4.1"
git push origin main
git tag -a v0.4.1 -m "Dark Control v0.4.1"
git push origin v0.4.1
```

The `release` workflow verifies that the tag matches `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. It then runs the frontend/Rust checks, builds the portable EXE, MSI and NSIS installer, creates `SHA256SUMS.txt`, and publishes a GitHub Release using the repository's built-in `GITHUB_TOKEN`.

The release contains assets named like:

```text
Dark-Control-v0.4.1-Windows-x64.exe
Dark-Control-v0.4.1-Windows-x64.msi
Dark-Control-v0.4.1-Windows-x64-setup.exe
SHA256SUMS.txt
```

The in-app updater selects the `Windows-x64-setup.exe` asset.

## Security model

This simpler updater intentionally follows the same trust model as manually downloading an installer from the project's GitHub Release page: the release metadata and installer are fetched from GitHub over HTTPS. It does **not** add a separate Tauri updater signature layer.

Windows may therefore show its normal SmartScreen/reputation warning for an unsigned application. Eliminating that warning would require a separate Windows code-signing certificate, which is unrelated to the old Tauri updater key pair.

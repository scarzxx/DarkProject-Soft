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

Every successful push to `main` builds and uploads the workflow artifact `Dark-Control-Windows-x64` containing only Windows EXE files:

- `dark-control.exe` — portable development build
- NSIS setup `.exe` — installer used for testing the release path

No MSI package is built or uploaded.

## Publishing a release from VS Code

`package.json` is the only version file you need to edit manually.

For example, change:

```json
"version": "0.4.1"
```

to:

```json
"version": "0.4.2"
```

Then use the normal VS Code **Source Control** panel:

1. Save your files.
2. Enter a commit message.
3. Click **Commit**.
4. Click **Sync Changes** / **Push**.

No terminal command and no manual Git tag are required.

When the `package.json` version changes on `main`, the release workflow automatically:

1. synchronizes the same version into Tauri, Cargo, package-lock and UI fallbacks;
2. runs frontend and Rust tests;
3. builds the NSIS Windows setup EXE;
4. creates the matching tag, for example `v0.4.2`;
5. publishes a GitHub Release.

Changing code without changing the `package.json` version does **not** create a new release.

The public release contains one downloadable application asset:

```text
Dark-Control-v0.4.2-Windows-x64-setup.exe
```

The in-app updater selects that setup EXE automatically.

For local development, `npm run dev` and production frontend builds automatically synchronize the other version locations from `package.json`, so `package.json` remains the single source of truth.

## Security model

This simpler updater follows the same trust model as manually downloading an installer from the project's GitHub Release page: release metadata and the installer are fetched from GitHub over HTTPS. It does **not** add a separate Tauri updater signature layer.

Windows may therefore show its normal SmartScreen/reputation warning for an unsigned application. Eliminating that warning would require a separate Windows code-signing certificate, which is unrelated to the removed Tauri updater key pair.

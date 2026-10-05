# Development

## Start app

```powershell
npm run tauri:dev
```

With `.vscode/tasks.json`, press **Ctrl+Shift+B**.

## Local build

```powershell
npm run tauri:build
```

## Publish release

```powershell
git tag v0.3.1
git push origin v0.3.1
```

A `v*` tag automatically creates the GitHub Release.

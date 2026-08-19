# MTR Diagnostic Suite

A technician-focused desktop tool for testing and troubleshooting Microsoft Teams Rooms devices.

## Runtime modes

- **Packaged Electron on Windows:** can run the fixed, built-in diagnostic and update operations. Start the application as Administrator; elevation is checked again for every privileged operation.
- **Standalone development/preview server:** binds only to `127.0.0.1` and serves the UI. It has no command-execution HTTP API.
- **Non-Windows:** provides an explicit preview response and never claims that a Windows operation ran.

## Windows downloads

Each release provides two Windows executables:

- **MTR Diagnostic Suite Setup.exe** — the NSIS installer for a conventional system installation.
- **MTR Diagnostic Suite Portable.exe** — a no-install build that can be run directly.

Both editions must still be run as Administrator for privileged diagnostic and update operations. “Portable” means no installation is needed; it does not remove the elevation requirement.

The renderer can request only these bundled operation IDs:

- `run-diagnostics` — read-only health checks
- `scan-repair-updates` — requests a Windows Update scan and repairs existing MTR app registration; it does not install updates
- `install-mtr-update` — downloads and runs the Microsoft-signed fixed MTR updater

Script text and script types never cross HTTP or IPC boundaries. CMD launcher and EXE compiler actions are not runnable from the UI.

## Electron security boundary

The packaged app uses context isolation, disables renderer Node.js integration, enables Chromium sandboxing, and exposes only the fixed-operation method through its preload bridge. Child windows are denied. The official `https://go.microsoft.com` update link is opened in the system browser; other window creation and external navigation are blocked.

“Advanced tools” is a visibility preference, not a login or authentication boundary. Privilege decisions are made in Electron immediately before each operation.

## Development

```bash
npm ci
npm run dev
```

## Verification and build

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Build the packaged Windows application with:

```bash
npm run electron:build
```

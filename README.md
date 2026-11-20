# OPsCoder

A Windows desktop AI client built with Electron, React and TypeScript.

## Features

- **Two provider types**: native OpenCode Zen and custom OpenAI-compatible endpoints.
- **Three wire protocols**: OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages, with streamed SSE output.
- **Model discovery**: live catalogue loading, free-model tagging, cached results, and manual model IDs for APIs that expose no catalogue.
- **Local-first chats**: conversations and messages persist in SQLite and are restored on launch.
- **Stop an in-flight response** without losing the text already received.
- **Encrypted credentials**: API keys are stored with Electron `safeStorage` in the main process; the renderer never receives them.
- **Windows installer**: NSIS build with an optional clean-install path, plus a rolling `continuous` release from CI.

## Requirements

- Node.js 20+
- npm
- Windows recommended for installer and OS credential-storage testing

## Development

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
npm run dist:win
```

Installer output: `release/`.

CI stamps every main-branch build with the next patch version (`0.2.1`, `0.2.2`, ...), used in both the installer filename and the app metadata, then commits the bump back to `main` with `[skip ci]` so the next build continues from it. Pull-request builds neither bump nor publish.

## Architecture

| Path | Role |
| --- | --- |
| `src/main/index.ts` | App lifecycle, SQLite persistence, credential encryption, IPC validation, provider HTTP and SSE streaming |
| `src/preload/index.ts` | Restricted `window.opscoder` bridge exposed with `contextBridge` |
| `src/renderer/src/App.tsx` | Chat, Connections, Models and Settings UI |
| `src/renderer/src/styles.css` | Dark desktop theme |
| `electron.vite.config.ts` | Main/preload/renderer builds plus the production CSP injection |

## Security

- `contextIsolation` and `sandbox` are enabled; `nodeIntegration` is disabled.
- IPC input is validated with zod before it reaches the database or network.
- Custom base URLs must use HTTPS; HTTP is allowed only for loopback hosts.
- API keys, databases and build artifacts are never committed.
- A strict Content-Security-Policy is injected into production builds; the dev server keeps its HMR-friendly policy.
- Navigation, popups, webviews and renderer permission requests are blocked.

## V1 provider scope

- OpenCode Zen native integration
- Custom OpenAI-compatible Chat Completions endpoint

Other native provider integrations are deferred.

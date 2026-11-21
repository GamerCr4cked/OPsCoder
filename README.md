# OPsCoder

A Windows desktop AI client built with Electron, React and TypeScript.

## Features

- **Chat-first sidebar**: searchable, date-grouped history with rename and delete, a collapsible rail, and no connection clutter.
- **Two provider types**: native OpenCode Zen and custom OpenAI-compatible endpoints.
- **Three wire protocols**: OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages, with streamed SSE output.
- **Model discovery**: live catalogue loading, free-model tagging, cached results, and manual model IDs for APIs that expose no catalogue.
- **Themes**: dark, light, or a custom theme with your own accent color. Appearance is saved per device.
- **Local-first chats**: conversations and messages persist in SQLite and are restored on launch.
- **Stop an in-flight response** without losing the text already received.
- **CLI mode**: toggle it in the composer, pick a workspace folder, and let the model inspect and change files by running shell commands. Every command asks for approval, with *Allow once*, *Always allow in this chat* and *Deny*. Auto-approve can be turned off again, and turning CLI mode off clears it.
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

## CLI mode

Turn on **CLI** in the composer to let the model inspect and change files. The first time, OPsCoder asks for a workspace folder; the folder is remembered for that chat.

Every proposed command opens an approval dialog:

- **Allow once** runs the command a single time.
- **Always allow in this chat** runs it and auto-approves later commands in the same chat. Click the **×** beside the auto-approve badge to return to per-command approval.
- **Deny** tells the model the command was refused.

Turning CLI off stops new approvals and clears auto-approve. Commands run through PowerShell as your Windows user, with a 120-second timeout and a 120 KB output cap. Commands are **not** sandboxed, so they can reach files outside the chosen workspace.

Models with native tool calling receive a `run_command` tool. If the protocol does not expose tools, or the API rejects the tool request, OPsCoder falls back to executing fenced code blocks tagged `cli`; both paths use the same approval flow.

## Architecture

| Path | Role |
| --- | --- |
| `src/main/index.ts` | App lifecycle, SQLite persistence, credential encryption, IPC validation, provider HTTP and SSE streaming |
| `src/preload/index.ts` | Restricted `window.opscoder` bridge exposed with `contextBridge` |
| `src/renderer/src/App.tsx` | App shell, chat state, theme state and IPC orchestration |
| `src/renderer/src/components/Sidebar.tsx` | Searchable chat history, chat actions and profile footer |
| `src/renderer/src/components/ChatView.tsx` | Messages, empty state, CLI activity and composer |
| `src/renderer/src/components/SettingsView.tsx` | Appearance, Connections, Models and About |
| `src/renderer/src/components/Modals.tsx` | Connection, rename, delete and command-approval dialogs |
| `src/renderer/src/theme.ts` | Persisted dark, light and custom theme system |
| `src/renderer/src/styles.css` | Theme variables, layout and component styles |
| `electron.vite.config.ts` | Main/preload/renderer builds plus the production CSP injection |

## Security

- `contextIsolation` and `sandbox` are enabled; `nodeIntegration` is disabled.
- IPC input is validated with zod before it reaches the database or network.
- Custom base URLs must use HTTPS; HTTP is allowed only for loopback hosts.
- API keys, databases and build artifacts are never committed.
- A strict Content-Security-Policy is injected into production builds; the dev server keeps its HMR-friendly policy.
- Navigation, popups, webviews and renderer permission requests are blocked.
- CLI mode is opt-in per chat, commands run in the chosen workspace with a 120-second timeout and an output cap, and commands cannot run unless the user approves them (or enables auto-approve for that chat). Commands execute as the logged-in Windows user, so only use CLI mode in workspaces you trust.

## V1 provider scope

- OpenCode Zen native integration
- Custom OpenAI-compatible Chat Completions endpoint

Other native provider integrations are deferred.

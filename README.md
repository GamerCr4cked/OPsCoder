# OPsCoder

A Windows desktop AI client built with Electron, React and TypeScript.

## Current status

This is the initial desktop-shell milestone. It includes the dark desktop UI, navigation, connection management, SQLite persistence, Electron `safeStorage` credential encryption, a restricted preload bridge, IPC input validation, and NSIS installer configuration.

**Important:** OPsCoder is not yet a functioning AI chat client. Provider requests, model discovery, API-key testing, streaming, and conversation restoration are not implemented in this milestone.

## Requirements

- Node.js 20+
- npm
- Windows recommended for installer and OS credential-storage testing

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist:win
```

Installer output: `release/`.

## V1 provider scope

- OpenCode Zen native integration
- Custom OpenAI-compatible Chat Completions endpoint

Other native provider integrations are deferred.

## Security

Never commit API keys, local databases, or build artifacts. Credentials remain in Electron's main process and are encrypted with OS-backed secure storage.

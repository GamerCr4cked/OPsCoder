# OPsCoder

A Windows desktop AI client built with Electron, React and TypeScript.

This repository is being initialized from the V1 desktop scaffold. The first milestone is a stable, secure desktop shell; provider networking and streaming will be added in subsequent milestones.

## Current status

The initial scaffold includes the dark desktop UI, navigation, connection management UI, SQLite persistence, Electron safeStorage credential encryption, secure preload bridge, and NSIS installer configuration. It is not yet a functional AI chat client: provider requests, model discovery, streaming, and conversation restoration remain planned work.

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

Never commit API keys, local databases, or build artifacts. Credentials must remain in Electron's main process and be protected with OS-backed secure storage.

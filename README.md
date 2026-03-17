# dev-cli

Developer productivity CLI tool built with Node.js.

## Features

- **`dev init`** — Scaffold a new project from templates (node, react)
- **`dev build`** — Build the current project with environment support
- **`dev deploy`** — Deploy with platform auto-detection (Vercel, Netlify, Fly.io, Docker)

## Installation

```bash
npm install -g dev-cli
```

## Usage

### Initialize a new project

```bash
# Node.js project (default)
dev init my-app

# React project
dev init my-app --template react

# Skip git init and npm install
dev init my-app --no-git --no-install
```

### Build

```bash
# Development build (default)
dev build

# Production build with minification
dev build --env production --minify

# Build with source maps
dev build --env staging --sourcemap
```

### Deploy

```bash
# Deploy to production (auto-detects platform)
dev deploy

# Deploy to staging
dev deploy --env staging

# Dry run (no actual changes)
dev deploy --dry-run

# Force deploy (skip checks)
dev deploy --force
```

## Supported Templates

| Template | Description |
|----------|-------------|
| `node`   | Node.js ESM project with npm scripts |
| `react`  | React + Vite project |

## Deploy Platforms (Auto-detected)

| File / Config | Platform |
|--------------|----------|
| `vercel.json` | Vercel |
| `netlify.toml` | Netlify |
| `fly.toml` | Fly.io |
| `Dockerfile` | Docker |
| `"deploy"` in scripts | Custom npm script |

## Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

## License

MIT

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-18

### Added

- `dev init` — scaffold Node.js or React projects with configurable options
  - `--type` flag to choose between `node` (default) and `react`
  - `--no-git` to skip `git init`
  - `--no-install` to skip `npm install`
- `dev build` — auto-detect project type and run appropriate build step
  - `--env` flag to set build environment (`development`, `staging`, `production`)
  - `--minify` flag to enable minification
  - `--sourcemap` flag to generate source maps
- `dev deploy` — auto-detect deployment platform and deploy
  - Supported platforms: Vercel, Netlify, Fly.io, Docker
  - `--env` flag to set deploy environment
  - `--dry-run` flag to simulate deploy without making changes
- Colored output via chalk for better CLI UX
- Spinner feedback via ora for long-running operations
- 68 Vitest tests (unit + integration) with ≥90% coverage
  - 98.97% statement coverage
  - 94.33% branch coverage
  - 100% function coverage
  - 99.44% line coverage

### Changed

- Replaced Jest with Vitest for faster test execution
- Updated test script to `vitest run`

[1.0.0]: https://github.com/tranhoangtu-it/dev-cli/releases/tag/v1.0.0

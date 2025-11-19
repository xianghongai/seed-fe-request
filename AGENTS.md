# Repository Guidelines

This repository contains @seed-fe/request, a TypeScript HTTP request library built on Axios. Use this guide to contribute effectively and consistently.

## Project Structure & Module Organization

- src/: library source
  - index.ts (entry), core/ (instance lifecycle), interceptors/ (parser/manager), utils/ (helpers), error/ (error handling), constant/ (messages), types.ts
- test/: Vitest unit tests (pattern: test/**/*.test.ts)
- dist/: build outputs (ESM, CJS, d.ts) - do not edit
- Config: tsconfig.json, tsup.config.ts, biome.json; CI: .github/workflows/release.yml

## Build, Test, and Development Commands

- pnpm install: install deps (Node LTS recommended)
- pnpm dev: watch build with tsup
- pnpm build: produce dist (esm/cjs + types, sourcemaps)
- pnpm test | pnpm test:watch | pnpm test:coverage: run tests/coverage
- pnpm check | pnpm format: lint/format via Biome

## Coding Style & Naming Conventions

- TypeScript strict mode; 2-space indent, 120-char line width, single quotes, trailing commas (ES5) enforced by Biome
- File names: kebab-case; prefer named exports; only add default exports when a single primary API is intended
- Keep modules small and focused; update types in src/types.ts when adding public APIs

## Testing Guidelines

- Framework: Vitest (environment: node); tests live under test/**/*.test.ts
- Add unit tests for new behavior and edge cases; mock Axios where applicable
- Run pnpm test:coverage before PRs; generated reports are in coverage/

## Commit & Pull Request Guidelines

- Use Conventional Commits: feat|fix|docs|build|chore|test with optional scope
  - Examples: feat(core): add named instance support; fix(interceptors): handle invalid tuple
- PRs must include: clear description, linked issues, tests for changes, and docs updates (README/API) when user-facing
- Verify locally: pnpm check && pnpm test && pnpm build; do not modify dist/ directly

## Release Process

- Releases are automated on tags matching v*: pushing a tag triggers build and pnpm publish via GitHub Actions

Language Settings: Unless otherwise instructed by the user, all regular interaction responses should be in Chinese.

## Active Technologies
- TypeScript 5.x（严格模式），Node LTS，ESM/CJS 构建 + axios ^1.x（peer），@seed-fe/logger（可选），开发：vitest、tsup、typescrip (001-error-handler-hierarchy)
- TypeScript 5.x（严格），Node LTS；ESM/CJS 构建 + axios ^1.x（peer）；开发：vitest、tsup (001-composed-error-handling)
- TypeScript 5.x（严格），Node LTS；ESM/CJS 构建 + axios ^1.x（peer）；开发：vitest、tsup、typescrip (001-interceptor-presets)
- TypeScript 5.x（严格模式） + Axios ^1.x（peer），开发工具：Vitest、tsup (004-refactor-plan)

## Recent Changes
- 001-error-handler-hierarchy: Added TypeScript 5.x（严格模式），Node LTS，ESM/CJS 构建 + axios ^1.x（peer），@seed-fe/logger（可选），开发：vitest、tsup、typescrip

# Git Hooks

This directory contains git hooks for the Filament project.

## Available Hooks

### pre-commit
Runs before each commit to ensure:
1. The project builds successfully
2. The `dist/` folder is up to date

If either check fails, the commit is aborted.

## Setup

The `prepare` script in `package.json` automatically configures git to use these hooks:
```bash
npm install
```

This runs the `prepare` script which sets `core.hooksPath` to `.githooks`.

## Manual Setup

If hooks are not enabled, you can manually configure them:
```bash
git config core.hooksPath .githooks
```

## Permissions

On Unix-like systems, ensure hooks have execute permissions:
```bash
chmod +x .githooks/*
```

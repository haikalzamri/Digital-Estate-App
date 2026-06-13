# AGENTS.md

## Purpose

This project uses a VM-first development workflow. The Mac is the host machine and Dropbox sync location. Development commands, package installation, runtime checks, and local servers should run inside the Ubuntu Parallels VM.

## Project Context

- Project root on Mac: `/Users/haikalzamri/Library/CloudStorage/Dropbox/digital-estate-app`
- Shared storage model: project files are stored in Dropbox and synced between environments.
- Development environment: Ubuntu 24.04.3 ARM64 running in Parallels.
- VM SSH target: `parallels@10.211.55.3`
- Do not store passwords, tokens, API keys, or secrets in this repository.

## Core Workflow

1. Treat the Mac environment as a host and file-sync layer only.
2. Do not install development dependencies on macOS unless explicitly approved.
3. Do not run application tooling on macOS unless explicitly approved.
4. Run development commands inside the Ubuntu VM.
5. Keep project source files in the Dropbox-synced project folder.
6. Verify that Dropbox sync is complete before assuming file changes are available in both environments.

## File Handling Rules

- Read and inspect files as needed before making changes.
- Do not modify, overwrite, rename, delete, or restructure existing files unless explicitly approved.
- For new work, ask where the file should be created and what filename should be used.
- If an existing file needs to change, explain what will change, why it is needed, and wait for confirmation.
- Avoid broad restructuring unless the user clearly asks for it.
- Keep changes focused and easy to review.

## Development Commands

Use SSH or Parallels VM execution for development tasks.

Example SSH access:

```bash
ssh parallels@10.211.55.3
```

Run project setup, dependency installation, app servers, build commands, tests, and checks from inside Ubuntu.

Do not run commands like these on macOS unless the user explicitly approves:

```bash
npm install
npm run dev
python -m venv
pip install
brew install
```

## Project Structure Preference

- Keep the runnable web app entry files at the project root where practical.
- Root-level app files may include `index.html`, `styles.css`, `app.js`, and related JavaScript data files.
- Avoid unnecessary nested folders for simple static web assets unless the project grows and a structure is approved.

## Verification Expectations

Before reporting completion:

1. Confirm the relevant files are in the expected location.
2. Confirm the app references still point to valid relative paths.
3. Run verification from the Ubuntu VM where possible.
4. Summarise what changed, what was not changed, and any risks or next steps.

## Communication Style

- Be concise, structured, and practical.
- Use clear status updates.
- Highlight assumptions, risks, dependencies, and recommended next steps.
- Keep outputs suitable for project delivery and stakeholder review.

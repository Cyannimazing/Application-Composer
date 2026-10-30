# Standalone Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline implementation.

**Goal:** One desktop EXE with AC icon, its own window, minimize-to-tray and close-to-shutdown.

**Architecture:** Embedded Next standalone, Node and WebView2 SDK in a C# Windows Forms host. Versioned resources and persistent data are separate under LocalAppData. Windows job objects atomically contain server descendants.

**Spec:** docs/superpowers/specs/2026-10-30-desktop-launcher.md

## Verified implementation

- [x] Native tests cover archive traversal, profile migration preservation, missing builds, external server preservation and owned/abrupt cleanup.
- [x] Complete pnpm dependency aliases, bundle Node and companion files, exclude private data and handle Windows long paths.
- [x] Staging renders the app outside the project without Node/pnpm/NODE_PATH before archiving.
- [x] Actual extracted EXE starts/stops the bundled server; embedded WebView renders the app with migrated profile and existing CLI login.
- [x] Actual window-close shuts down the app server. Actual minimize hides to tray and preserves the server; repeated EXE launch restores the same window.
- [x] Validated native-to-companion dispatch closes only its unchanged temporary tab; worker tests preserve the job tab and navigated tabs.
- [x] Actual CLI review includes portfolio and GitHub and removes technology version numbers.
- [x] Full application tests and TypeScript checks pass; fresh code review has no code blockers.

## Rulings

The user clarified the initial browser launcher into a standalone window, then requested tray hiding. Minimize keeps the server alive; X and Exit stop it. The app refuses external servers rather than claiming ownership. Browser handoff uses the Windows default profile with the paired extension; a real external job form is not modified during packaging QA. Data is migrated once, not embedded. The runtime is shipped in the executable; the selected CLI/login remains external.

Publication: stage sources, docs, tests and icon only; scan for credentials, commit, push and verify remote SHA. Generated EXE, SDK, archive and app data remain excluded from Git.

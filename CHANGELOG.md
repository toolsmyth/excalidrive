# Changelog

All notable changes to Excalidrive are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-25

### Added
- **Install as an app (PWA).** Excalidrive can now be installed from Chrome, Edge, or Android ("Install app" button), or added to the Home Screen from Safari on iPhone.
- **Works offline.** The installed app opens without internet, and drawings saved on this device stay editable. Google Drive saving needs a connection.
- **Autosave delay setting.** Choose how long to wait after you stop drawing before saving: 5 seconds, 30 seconds, 1 minute, or 5 minutes. Your choice is remembered in the browser.
- **Save now button.** Appears in the header whenever there are unsaved changes.
- App icons for home screens and launchers, including an Android adaptive (maskable) icon.

### Changed
- Drawings are now also saved immediately when you switch tabs, minimize, or close the app, so a longer autosave delay never loses work.
- Default autosave delay is 5 seconds (previously 1.5 seconds).

### Fixed
- The New folder / New drawing dialog no longer appears in the top-left corner before jumping to the center.

## [1.1.0] - 2026-11-19

### Added
- Privacy policy and terms of service pages.
- Privacy, Terms, and GitHub links on the sign-in screen.
- Excalidrive logo, browser tab icon (favicon), and iPhone home-screen icon.

## [1.0.0] - 2026-11-19

### Added
- First release.
- Excalidraw editor with folders and nested folders, each holding independent drawings.
- Saves to your own Google Drive in an "Excalidrive" folder, with access limited to files the app creates (`drive.file`).
- "Skip for now" mode that saves drawings in the browser, with one-click sync to Google Drive later.
- Autosave with a Saved / Saving / Unsaved indicator, and Cmd/Ctrl+S to save instantly.
- Create, rename, and delete folders and drawings. Deleted items go to the Drive trash.
- Light and dark themes, plus a reconnect banner when the Google session expires.
- Deployed to GitHub Pages automatically on every push to `main`.

[1.2.0]: https://github.com/toolsmyth/excalidrive/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/toolsmyth/excalidrive/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/toolsmyth/excalidrive/releases/tag/v1.0.0

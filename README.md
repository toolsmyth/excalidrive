# Excalidrive

Excalidraw boards organized in folders, saved straight to the user's own Google Drive.
No backend: the browser talks to Google Drive directly.

- **Folders → files** hierarchy (as deep as you like), each drawing is an independent `.excalidraw` file
- **Google Drive storage** in a `My Drive/Excalidrive/` folder, using the `drive.file` scope (the app can only see files it created)
- **Autosave** 1.5 s after you stop drawing (or `Cmd/Ctrl + S`), with a Saved / Saving / Unsaved indicator
- **Local demo mode** (localStorage) so you can use it before setting up Google
- UI built with **shadcn/ui** (new-york, neutral) + Tailwind v4 + Radix + lucide; light/dark theme

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Click **"Skip for now"** to start right away. Drawings are kept in the browser; after you connect Google Drive, a banner offers to sync them (folders included).

## Enable Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform)
   - User type: **External**, fill in app name + support email
   - Data access / Scopes: add `https://www.googleapis.com/auth/drive.file`
   - Audience: add your Google account under **Test users** (while in Testing mode)
4. **Credentials → Create credentials → OAuth client ID** → **Web application**
   - Authorized JavaScript origins: `http://localhost:5173` (plus your production URL later)
   - No redirect URI needed (popup token flow)
5. Copy the Client ID:
   ```bash
   cp .env.example .env
   # paste into VITE_GOOGLE_CLIENT_ID=...
   ```
6. Restart `npm run dev` → **Connect Google Drive**.

`drive.file` is a *non-sensitive* scope, so publishing the app later doesn't need Google's security assessment (only basic verification of the consent screen).

## How it's structured

```
src/
  lib/storage/
    types.ts          StorageProvider interface (list/create/read/write/rename/remove)
    google-auth.ts    Google Identity Services token flow (browser-only OAuth)
    google-drive.ts   Drive v3 REST implementation
    local.ts          localStorage implementation (demo mode)
  components/
    ui/               shadcn components (button, input, dialog, dropdown-menu, tooltip)
    workspace.tsx     sidebar + header + dialogs, tree state
    file-tree.tsx     recursive folder/file tree with row menus
    editor.tsx        Excalidraw wrapper with change detection + debounced autosave
    login-screen.tsx
```

Add more shadcn components any time: `npx shadcn@latest add sheet` (config is in `components.json`).

## Notes / next ideas

- Access tokens last ~1 hour. When one expires, a banner asks you to **Reconnect**; unsaved changes are kept and saved after reconnecting.
- Deleting moves items to Drive's trash (restorable for 30 days).
- Pasted images are stored inside the drawing JSON, so image-heavy boards get big. A future improvement is to store images as separate Drive files.
- Ideas: drag-and-drop to move files, search, thumbnails, IndexedDB cache for offline + instant open, deploy to Vercel / GitHub Pages.

## Deploy (GitHub Pages)

Pushing to `main` builds and deploys automatically via `.github/workflows/deploy.yml`.

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Repo **Settings → Secrets and variables → Actions → Variables → New variable**: `VITE_GOOGLE_CLIENT_ID` = your Client ID
3. In Google Cloud, add `https://toolsmyth.github.io` to the OAuth client's **Authorized JavaScript origins**

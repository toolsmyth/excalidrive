/**
 * Google Identity Services (GIS) token flow — runs entirely in the browser.
 * We never see the user's password; Google hands us a short-lived access token
 * scoped to `drive.file` (only files this app creates).
 */

declare global {
  interface Window {
    google?: any;
  }
}

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const TOKEN_KEY = "excalidrive:google-token";
const ACCOUNT_KEY = "excalidrive:google-account";

/** The Google account this browser last connected, so reopening the app skips the login screen. */
export interface RememberedAccount {
  name: string;
  email: string;
  photoUrl?: string;
  rootId: string;
}

export interface GoogleToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let gisPromise: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("Could not load Google sign-in. Check your connection or ad blocker."));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

export function getClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return id && id.trim() ? id.trim() : undefined;
}

/**
 * Gets a Drive access token via Google's popup (must be called from a click handler).
 * With `hint` (the remembered email) and prompt "", Google reuses the existing browser session:
 * the popup closes by itself with no account picker or consent screen.
 */
export async function requestGoogleToken(
  opts: { prompt?: "" | "consent" | "select_account"; hint?: string } = {},
): Promise<GoogleToken> {
  const clientId = getClientId();
  if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID is not set");
  await loadGis();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      ...(opts.hint ? { login_hint: opts.hint, hint: opts.hint } : {}),
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
          return reject(new Error("Drive access was not granted. Please allow it to store your drawings."));
        }
        const token: GoogleToken = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) - 60) * 1000,
        };
        // localStorage (not sessionStorage) so the token survives closing and reopening the app.
        localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        resolve(token);
      },
      error_callback: (err: any) => reject(new Error(err?.message || err?.type || "Sign-in cancelled")),
    });
    client.requestAccessToken({ prompt: opts.prompt ?? "" });
  });
}

/** Token from a previous sign-in on this browser, if still valid (Google tokens last ~1 hour). */
export function getStoredToken(): GoogleToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as GoogleToken;
    return t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function getRememberedAccount(): RememberedAccount | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null") as RememberedAccount | null;
    return a?.email && a.rootId ? a : null;
  } catch {
    return null;
  }
}

export function rememberAccount(account: RememberedAccount) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

/** Sign out: forget the token and the account on this browser, and revoke the token at Google. */
export function revokeGoogleToken(token: string) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
  sessionStorage.removeItem(TOKEN_KEY); // tokens saved by older versions
  try {
    window.google?.accounts?.oauth2?.revoke(token, () => {});
  } catch {
    /* ignore */
  }
}

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

export interface GoogleToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
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

/** Opens Google's consent popup (must be called from a click handler). */
export async function requestGoogleToken(opts: { prompt?: "" | "consent" | "select_account" } = {}): Promise<GoogleToken> {
  const clientId = getClientId();
  if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID is not set");
  await loadGis();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
          return reject(new Error("Drive access was not granted. Please allow it to store your drawings."));
        }
        const token: GoogleToken = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) - 60) * 1000,
        };
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        resolve(token);
      },
      error_callback: (err: any) => reject(new Error(err?.message || err?.type || "Sign-in cancelled")),
    });
    client.requestAccessToken({ prompt: opts.prompt ?? "" });
  });
}

/** Token from this tab's previous sign-in, if still valid. */
export function getStoredToken(): GoogleToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as GoogleToken;
    return t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function revokeGoogleToken(token: string) {
  sessionStorage.removeItem(TOKEN_KEY);
  try {
    window.google?.accounts?.oauth2?.revoke(token, () => {});
  } catch {
    /* ignore */
  }
}

import { rememberAccount, revokeGoogleToken, type GoogleToken, type RememberedAccount } from "./google-auth";
import {
  AuthExpiredError,
  DRAWING_EXT,
  sortNodes,
  stripExt,
  type FsNode,
  type StorageProvider,
  type UserInfo,
} from "./types";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRAWING_MIME = "application/vnd.excalidraw+json";
const ROOT_FOLDER_NAME = "Excalidrive";
const APP_TAG = "excalidrive"; // stored in appProperties so we can recognise our files

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export class GoogleDriveProvider implements StorageProvider {
  readonly kind = "google" as const;

  private constructor(
    private token: GoogleToken,
    readonly rootId: string,
    readonly user: UserInfo,
  ) {}

  /** Connects with a token, finds (or creates) the app's root folder in My Drive. */
  static async connect(token: GoogleToken): Promise<GoogleDriveProvider> {
    const tmp = new GoogleDriveProvider(token, "", { name: "" });
    const about = await tmp.json<{ user: { displayName: string; emailAddress: string; photoLink?: string } }>(
      `${API}/about?fields=user(displayName,emailAddress,photoLink)`,
    );
    const user: UserInfo = {
      name: about.user.displayName,
      email: about.user.emailAddress,
      photoUrl: about.user.photoLink,
    };
    const rootId = await tmp.findOrCreateRoot();
    rememberAccount({ name: user.name, email: user.email!, photoUrl: user.photoUrl, rootId });
    return new GoogleDriveProvider(token, rootId, user);
  }

  /**
   * Reopens a remembered account without any network calls, so the app can show the workspace
   * immediately. With no valid token, Drive calls throw AuthExpiredError until setToken() is called.
   */
  static restore(account: RememberedAccount, token: GoogleToken | null): GoogleDriveProvider {
    return new GoogleDriveProvider(token ?? { accessToken: "", expiresAt: 0 }, account.rootId, {
      name: account.name,
      email: account.email,
      photoUrl: account.photoUrl,
    });
  }

  hasValidToken() {
    return Date.now() < this.token.expiresAt;
  }

  /** Swap in a fresh token after re-auth, keeping the same root. */
  setToken(token: GoogleToken) {
    this.token = token;
  }

  // ---------- HTTP ----------

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    if (Date.now() > this.token.expiresAt) throw new AuthExpiredError();
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.token.accessToken}`, ...(init.headers || {}) },
    });
    if (res.status === 401) throw new AuthExpiredError();
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        msg = body?.error?.message || msg;
      } catch {
        /* ignore */
      }
      throw new Error(`Google Drive: ${msg}`);
    }
    return res;
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    return (await this.req(url, init)).json();
  }

  private toNode(f: DriveFile, parentId: string): FsNode {
    const isFolder = f.mimeType === FOLDER_MIME;
    return {
      id: f.id,
      name: isFolder ? f.name : stripExt(f.name),
      kind: isFolder ? "folder" : "drawing",
      parentId,
      modifiedTime: f.modifiedTime,
    };
  }

  private async findOrCreateRoot(): Promise<string> {
    const q = `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`;
    const res = await this.json<{ files: DriveFile[] }>(
      `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    );
    if (res.files.length) return res.files[0].id;
    const created = await this.json<DriveFile>(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME, appProperties: { app: APP_TAG } }),
    });
    return created.id;
  }

  // ---------- StorageProvider ----------

  async list(parentId: string): Promise<FsNode[]> {
    const q = `'${esc(parentId)}' in parents and trashed=false`;
    const out: FsNode[] = [];
    let pageToken: string | undefined;
    do {
      const url =
        `${API}/files?q=${encodeURIComponent(q)}&pageSize=1000` +
        `&fields=nextPageToken,files(id,name,mimeType,modifiedTime)` +
        (pageToken ? `&pageToken=${pageToken}` : "");
      const res = await this.json<{ files: DriveFile[]; nextPageToken?: string }>(url);
      for (const f of res.files) {
        if (f.mimeType === FOLDER_MIME || f.name.endsWith(DRAWING_EXT)) out.push(this.toNode(f, parentId));
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
    return sortNodes(out);
  }

  async createFolder(parentId: string, name: string): Promise<FsNode> {
    const f = await this.json<DriveFile>(`${API}/files?fields=id,name,mimeType,modifiedTime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId], appProperties: { app: APP_TAG } }),
    });
    return this.toNode(f, parentId);
  }

  async createDrawing(parentId: string, name: string, content: string): Promise<FsNode> {
    const boundary = "excalidrive" + Math.random().toString(36).slice(2);
    const metadata = {
      name: name + DRAWING_EXT,
      mimeType: DRAWING_MIME,
      parents: [parentId],
      appProperties: { app: APP_TAG },
    };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${DRAWING_MIME}\r\n\r\n${content}\r\n--${boundary}--`;
    const f = await this.json<DriveFile>(
      `${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime`,
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    );
    return this.toNode(f, parentId);
  }

  async read(id: string): Promise<string> {
    return (await this.req(`${API}/files/${id}?alt=media`)).text();
  }

  async write(id: string, content: string): Promise<void> {
    await this.req(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": DRAWING_MIME },
      body: content,
    });
  }

  async rename(node: FsNode, name: string): Promise<void> {
    await this.req(`${API}/files/${node.id}?fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: node.kind === "drawing" ? name + DRAWING_EXT : name }),
    });
  }

  /** Moves to Drive trash (recoverable for 30 days). Trashing a folder trashes its contents. */
  async remove(node: FsNode): Promise<void> {
    await this.req(`${API}/files/${node.id}?fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }

  signOut() {
    revokeGoogleToken(this.token.accessToken);
  }
}

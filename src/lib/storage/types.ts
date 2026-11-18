export type NodeKind = "folder" | "drawing";

export interface FsNode {
  id: string;
  name: string; // display name (no ".excalidraw" extension)
  kind: NodeKind;
  parentId: string;
  modifiedTime?: string;
}

export interface UserInfo {
  name: string;
  email?: string;
  photoUrl?: string;
}

/**
 * Anything that can hold a tree of folders + drawings.
 * The UI only talks to this interface, so new backends (OneDrive, Dropbox,
 * local filesystem via File System Access API...) can be added later.
 */
export interface StorageProvider {
  readonly kind: "google" | "local";
  readonly rootId: string;
  readonly user: UserInfo;
  list(parentId: string): Promise<FsNode[]>;
  createFolder(parentId: string, name: string): Promise<FsNode>;
  createDrawing(parentId: string, name: string, content: string): Promise<FsNode>;
  read(id: string): Promise<string>;
  write(id: string, content: string): Promise<void>;
  rename(node: FsNode, name: string): Promise<void>;
  remove(node: FsNode): Promise<void>;
  signOut(): void;
}

export class AuthExpiredError extends Error {
  constructor() {
    super("Google session expired");
    this.name = "AuthExpiredError";
  }
}

export const DRAWING_EXT = ".excalidraw";

export const stripExt = (name: string) =>
  name.endsWith(DRAWING_EXT) ? name.slice(0, -DRAWING_EXT.length) : name;

export const sortNodes = (nodes: FsNode[]) =>
  [...nodes].sort((a, b) =>
    a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

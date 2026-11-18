import { sortNodes, type FsNode, type StorageProvider } from "./types";

/**
 * Browser-only storage (localStorage). Used for "demo mode" so the app works
 * before a Google Client ID is configured. Data stays in this browser.
 */
const TREE_KEY = "excalidrive:local:tree";
const FILE_KEY = (id: string) => `excalidrive:local:file:${id}`;
const ROOT = "local-root";

type Tree = Record<string, FsNode>;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export class LocalProvider implements StorageProvider {
  readonly kind = "local" as const;
  readonly rootId = ROOT;
  readonly user = { name: "This browser" };

  private load(): Tree {
    try {
      return JSON.parse(localStorage.getItem(TREE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  private save(tree: Tree) {
    localStorage.setItem(TREE_KEY, JSON.stringify(tree));
  }
  private touch(node: FsNode) {
    node.modifiedTime = new Date().toISOString();
  }

  async list(parentId: string) {
    return sortNodes(Object.values(this.load()).filter((n) => n.parentId === parentId));
  }

  async createFolder(parentId: string, name: string) {
    const tree = this.load();
    const node: FsNode = { id: uid(), name, kind: "folder", parentId };
    this.touch(node);
    tree[node.id] = node;
    this.save(tree);
    return node;
  }

  async createDrawing(parentId: string, name: string, content: string) {
    const tree = this.load();
    const node: FsNode = { id: uid(), name, kind: "drawing", parentId };
    this.touch(node);
    tree[node.id] = node;
    localStorage.setItem(FILE_KEY(node.id), content);
    this.save(tree);
    return node;
  }

  async read(id: string) {
    return localStorage.getItem(FILE_KEY(id)) ?? "";
  }

  async write(id: string, content: string) {
    try {
      localStorage.setItem(FILE_KEY(id), content);
    } catch {
      throw new Error("Browser storage is full. Connect Google Drive for larger drawings.");
    }
    const tree = this.load();
    if (tree[id]) {
      this.touch(tree[id]);
      this.save(tree);
    }
  }

  async rename(node: FsNode, name: string) {
    const tree = this.load();
    if (tree[node.id]) {
      tree[node.id].name = name;
      this.touch(tree[node.id]);
      this.save(tree);
    }
  }

  async remove(node: FsNode) {
    const tree = this.load();
    const drop = (id: string) => {
      for (const child of Object.values(tree)) if (child.parentId === id) drop(child.id);
      localStorage.removeItem(FILE_KEY(id));
      delete tree[id];
    };
    drop(node.id);
    this.save(tree);
  }

  signOut() {}
}

/** Number of drawings saved in this browser (used to offer syncing to Drive). */
export function countLocalDrawings(): number {
  try {
    const tree: Tree = JSON.parse(localStorage.getItem(TREE_KEY) || "{}");
    return Object.values(tree).filter((n) => n.kind === "drawing").length;
  } catch {
    return 0;
  }
}

const SYNC_MAP_KEY = "excalidrive:local:sync-map"; // local folder id -> drive folder id

/**
 * Copies everything saved in this browser into the target (Google Drive), keeping the folder structure.
 * Each item is removed locally right after it's uploaded, so if the sync is interrupted,
 * running it again continues where it stopped without creating duplicates.
 */
export async function syncLocalTo(target: StorageProvider, onProgress?: (done: number) => void): Promise<number> {
  const local = new LocalProvider();
  const map: Record<string, string> = JSON.parse(localStorage.getItem(SYNC_MAP_KEY) || "{}");
  let done = 0;

  const copy = async (localParent: string, targetParent: string) => {
    for (const node of await local.list(localParent)) {
      if (node.kind === "folder") {
        let targetId = map[node.id];
        if (!targetId) {
          targetId = (await target.createFolder(targetParent, node.name)).id;
          map[node.id] = targetId;
          localStorage.setItem(SYNC_MAP_KEY, JSON.stringify(map));
        }
        await copy(node.id, targetId);
        await local.remove(node); // now empty
      } else {
        await target.createDrawing(targetParent, node.name, await local.read(node.id));
        await local.remove(node);
        onProgress?.(++done);
      }
    }
  };

  await copy(ROOT, target.rootId);
  localStorage.removeItem(SYNC_MAP_KEY);
  localStorage.removeItem("excalidrive:last:local");
  return done;
}

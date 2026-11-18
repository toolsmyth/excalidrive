import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CloudOff,
  FilePlus2,
  FolderPlus,
  HardDrive,
  Loader2,
  LogOut,
  Moon,
  PanelLeft,
  PenTool,
  Plus,
  RefreshCw,
  Sun,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, NameDialog } from "@/components/dialogs";
import { EMPTY_DRAWING, Editor, type SaveStatus } from "@/components/editor";
import { FileTree, type TreeActions } from "@/components/file-tree";
import { cn } from "@/lib/utils";
import { requestGoogleToken } from "@/lib/storage/google-auth";
import { GoogleDriveProvider } from "@/lib/storage/google-drive";
import { countLocalDrawings, syncLocalTo } from "@/lib/storage/local";
import { AuthExpiredError, sortNodes, type FsNode, type NodeKind, type StorageProvider } from "@/lib/storage/types";
import type { Theme } from "@/hooks/use-theme";

type DialogState =
  | { type: "create"; kind: NodeKind; parentId: string }
  | { type: "rename"; node: FsNode }
  | { type: "delete"; node: FsNode }
  | null;

const lastKey = (p: StorageProvider) => `excalidrive:last:${p.kind}`;

export function Workspace({
  provider,
  theme,
  onToggleTheme,
  onSignOut,
}: {
  provider: StorageProvider;
  theme: Theme;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const root = provider.rootId;
  const [children, setChildren] = useState<Record<string, FsNode[] | undefined>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<FsNode | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const toastTimer = useRef<number | undefined>(undefined);
  const [localCount, setLocalCount] = useState(() => (provider.kind === "google" ? countLocalDrawings() : 0));
  const [syncDone, setSyncDone] = useState<number | null>(null);

  const showError = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  /** Runs a storage call; routes auth expiry to the reconnect banner and other errors to a toast. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof AuthExpiredError) setAuthExpired(true);
        else showError(e instanceof Error ? e.message : String(e));
        return undefined;
      }
    },
    [showError],
  );

  // id -> node for every node loaded so far (for breadcrumbs + descendant checks)
  const index = useMemo(() => {
    const m = new Map<string, FsNode>();
    for (const list of Object.values(children)) list?.forEach((n) => m.set(n.id, n));
    return m;
  }, [children]);

  const loadChildren = useCallback(
    async (parentId: string) => {
      setLoading((s) => new Set(s).add(parentId));
      const list = await run(() => provider.list(parentId));
      setLoading((s) => {
        const n = new Set(s);
        n.delete(parentId);
        return n;
      });
      if (list) setChildren((c) => ({ ...c, [parentId]: list }));
    },
    [provider, run],
  );

  // Initial load + reopen last drawing.
  useEffect(() => {
    void loadChildren(root);
    try {
      const last = JSON.parse(localStorage.getItem(lastKey(provider)) || "null") as FsNode | null;
      if (last) setActive(last);
    } catch {
      /* ignore */
    }
  }, [provider, root, loadChildren]);

  useEffect(() => {
    if (active) localStorage.setItem(lastKey(provider), JSON.stringify(active));
    else localStorage.removeItem(lastKey(provider));
  }, [active, provider]);

  const expand = useCallback(
    (id: string) => {
      setExpanded((s) => new Set(s).add(id));
      if (!children[id]) void loadChildren(id);
    },
    [children, loadChildren],
  );

  const isInside = useCallback(
    (nodeId: string, ancestorId: string) => {
      let cur = index.get(nodeId);
      while (cur) {
        if (cur.id === ancestorId) return true;
        cur = index.get(cur.parentId);
      }
      return false;
    },
    [index],
  );

  // ---- actions ----
  const actions: TreeActions = {
    toggle: (folder) => {
      if (expanded.has(folder.id)) {
        setExpanded((s) => {
          const n = new Set(s);
          n.delete(folder.id);
          return n;
        });
      } else expand(folder.id);
    },
    open: (drawing) => {
      setActive(drawing);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    create: (kind, parentId) => setDialog({ type: "create", kind, parentId }),
    rename: (node) => setDialog({ type: "rename", node }),
    remove: (node) => setDialog({ type: "delete", node }),
  };

  const doCreate = async (kind: NodeKind, parentId: string, name: string) => {
    const node = await run(() =>
      kind === "folder" ? provider.createFolder(parentId, name) : provider.createDrawing(parentId, name, EMPTY_DRAWING),
    );
    if (!node) return;
    setChildren((c) => ({ ...c, [parentId]: sortNodes([...(c[parentId] ?? []), node]) }));
    if (parentId !== root) expand(parentId);
    if (kind === "folder") {
      setChildren((c) => ({ ...c, [node.id]: [] }));
      setExpanded((s) => new Set(s).add(node.id));
    } else {
      setActive(node);
    }
  };

  const doRename = async (node: FsNode, name: string) => {
    const ok = await run(async () => {
      await provider.rename(node, name);
      return true;
    });
    if (!ok) return;
    setChildren((c) => ({
      ...c,
      [node.parentId]: sortNodes((c[node.parentId] ?? []).map((n) => (n.id === node.id ? { ...n, name } : n))),
    }));
    if (active?.id === node.id) setActive({ ...active, name });
  };

  const doDelete = async (node: FsNode) => {
    const ok = await run(async () => {
      await provider.remove(node);
      return true;
    });
    if (!ok) return;
    if (active && (active.id === node.id || isInside(active.id, node.id))) setActive(null);
    setChildren((c) => ({ ...c, [node.parentId]: (c[node.parentId] ?? []).filter((n) => n.id !== node.id) }));
  };

  const syncFromBrowser = async () => {
    setSyncDone(0);
    try {
      await syncLocalTo(provider, setSyncDone);
      setLocalCount(0);
      await loadChildren(root);
      setExpanded(new Set());
      setChildren((c) => ({ [root]: c[root] }));
    } catch (e) {
      if (e instanceof AuthExpiredError) setAuthExpired(true);
      else showError(`Sync stopped: ${e instanceof Error ? e.message : String(e)}. Try again to continue.`);
      setLocalCount(countLocalDrawings());
    } finally {
      setSyncDone(null);
    }
  };

  const reconnect = async () => {
    if (!(provider instanceof GoogleDriveProvider)) return;
    try {
      provider.setToken(await requestGoogleToken());
      setAuthExpired(false);
      setAuthEpoch((n) => n + 1);
      void loadChildren(root);
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- breadcrumb ----
  const crumbs = useMemo(() => {
    const out: string[] = [];
    let cur = active ? index.get(active.parentId) : undefined;
    while (cur) {
      out.unshift(cur.name);
      cur = index.get(cur.parentId);
    }
    return out;
  }, [active, index]);

  const rootItems = children[root];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[margin] duration-200",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-lg",
          !sidebarOpen && "-ml-64",
        )}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PenTool className="size-3.5" />
          </div>
          <span className="flex-1 font-semibold tracking-tight">Excalidrive</span>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="New">
                    <Plus />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>New</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => actions.create("drawing", root)}>
                <FilePlus2 /> New drawing
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.create("folder", root)}>
                <FolderPlus /> New folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">Files</div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!rootItems ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : rootItems.length === 0 ? (
            <div className="mx-1 mt-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No files yet.
              <div className="mt-3 flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => actions.create("folder", root)}>
                  <FolderPlus /> New folder
                </Button>
                <Button size="sm" variant="outline" onClick={() => actions.create("drawing", root)}>
                  <FilePlus2 /> New drawing
                </Button>
              </div>
            </div>
          ) : (
            <FileTree
              parentId={root}
              depth={0}
              children={children}
              expanded={expanded}
              loading={loading}
              activeId={active?.id ?? null}
              actions={actions}
            />
          )}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer">
                {provider.user.photoUrl ? (
                  <img src={provider.user.photoUrl} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
                ) : (
                  <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {provider.kind === "local" ? <HardDrive className="size-3.5" /> : provider.user.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{provider.user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {provider.kind === "google" ? provider.user.email : "Saved on this device"}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {provider.kind === "google" ? "Stored in Google Drive › Excalidrive" : "Stored in this browser only"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void loadChildren(root)}>
                <RefreshCw /> Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSignOut}>
                {provider.kind === "google" ? <LogOut /> : <UploadCloud />} {provider.kind === "google" ? "Disconnect Drive" : "Connect Google Drive to sync"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle sidebar">
                <PanelLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle sidebar</TooltipContent>
          </Tooltip>
          <div className="mx-1 h-4 w-px bg-border" />
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            {active ? (
              <>
                {crumbs.map((c, i) => (
                  <span key={i} className="flex min-w-0 items-center gap-1 max-sm:hidden">
                    <span className="truncate">{c}</span>
                    <ChevronRight className="size-3.5 shrink-0" />
                  </span>
                ))}
                <span className="truncate font-medium text-foreground">{active.name}</span>
              </>
            ) : (
              <span>No drawing open</span>
            )}
          </nav>
          {active && <SaveIndicator status={status} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onToggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        </header>

        {authExpired && (
          <div className="flex items-center gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm">
            <CloudOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="flex-1">Lost connection to Google Drive. Your changes are kept — reconnect to keep saving.</span>
            <Button size="sm" onClick={reconnect}>
              Reconnect
            </Button>
          </div>
        )}

        {localCount > 0 && !authExpired && (
          <div className="flex items-center gap-3 border-b bg-sky-500/10 px-4 py-2 text-sm">
            <UploadCloud className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="flex-1">
              {syncDone !== null
                ? `Syncing… ${syncDone} of ${localCount} drawings uploaded`
                : `You have ${localCount} drawing${localCount === 1 ? "" : "s"} saved on this device. Sync them to Google Drive?`}
            </span>
            <Button size="sm" onClick={syncFromBrowser} disabled={syncDone !== null}>
              {syncDone !== null && <Loader2 className="animate-spin" />}
              Sync to Drive
            </Button>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {active ? (
            <Editor
              key={`${provider.kind}:${active.id}`}
              provider={provider}
              node={active}
              theme={theme}
              authEpoch={authEpoch}
              onStatus={setStatus}
              onAuthExpired={() => setAuthExpired(true)}
              onError={showError}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
                <PenTool className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Pick a drawing or start a new one</p>
                <p className="mt-1 text-sm text-muted-foreground">Organize boards into folders from the sidebar.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => actions.create("folder", root)}>
                  <FolderPlus /> New folder
                </Button>
                <Button onClick={() => actions.create("drawing", root)}>
                  <FilePlus2 /> New drawing
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <NameDialog
        open={dialog?.type === "create"}
        title={dialog?.type === "create" && dialog.kind === "folder" ? "New folder" : "New drawing"}
        description={
          dialog?.type === "create" && dialog.parentId !== root
            ? `Inside “${index.get(dialog.parentId)?.name ?? "folder"}”`
            : undefined
        }
        initialValue={dialog?.type === "create" && dialog.kind === "folder" ? "Untitled folder" : "Untitled drawing"}
        submitLabel="Create"
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={async (name) => {
          if (dialog?.type === "create") await doCreate(dialog.kind, dialog.parentId, name);
        }}
      />
      <NameDialog
        open={dialog?.type === "rename"}
        title="Rename"
        initialValue={dialog?.type === "rename" ? dialog.node.name : ""}
        submitLabel="Save"
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={async (name) => {
          if (dialog?.type === "rename") await doRename(dialog.node, name);
        }}
      />
      <ConfirmDialog
        open={dialog?.type === "delete"}
        title={`Delete “${dialog?.type === "delete" ? dialog.node.name : ""}”?`}
        description={
          provider.kind === "google"
            ? `It will be moved to your Google Drive trash${dialog?.type === "delete" && dialog.node.kind === "folder" ? " along with everything inside it" : ""}. You can restore it from there for 30 days.`
            : `This permanently deletes it${dialog?.type === "delete" && dialog.node.kind === "folder" ? " and everything inside it" : ""} from this browser.`
        }
        confirmLabel="Delete"
        onOpenChange={(o) => !o && setDialog(null)}
        onConfirm={async () => {
          if (dialog?.type === "delete") await doDelete(dialog.node);
        }}
      />

      {toast && (
        <div
          role="alert"
          className="animate-pop fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
          data-state="open"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { icon: React.ReactNode; text: string; cls?: string }> = {
    idle: { icon: null, text: "" },
    saved: { icon: <Check className="size-3.5" />, text: "Saved" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Saving…" },
    unsaved: { icon: <span className="size-1.5 rounded-full bg-amber-500" />, text: "Unsaved" },
    error: { icon: <AlertCircle className="size-3.5" />, text: "Not saved", cls: "text-destructive" },
  };
  const s = map[status];
  if (!s.text) return null;
  return (
    <span className={cn("flex items-center gap-1.5 px-2 text-xs text-muted-foreground", s.cls)} aria-live="polite">
      {s.icon}
      {s.text}
    </span>
  );
}

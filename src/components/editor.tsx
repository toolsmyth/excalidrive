import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AuthExpiredError, type FsNode, type StorageProvider } from "@/lib/storage/types";
import type { Theme } from "@/hooks/use-theme";

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "error";

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type Elements = Parameters<OnChange>[0];
type AppState = Parameters<OnChange>[1];
type Files = Parameters<OnChange>[2];

const SAVE_DELAY_MS = 1500;

export const EMPTY_DRAWING = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "excalidrive",
  elements: [],
  appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
  files: {},
});

/** Cheap fingerprint: changes whenever any element is edited/added/deleted. Ignores scroll/zoom/selection. */
function signature(elements: readonly { version: number }[], files: object | undefined, bg: string | undefined) {
  let v = 0;
  for (const el of elements) v += el.version;
  return `${elements.length}:${v}:${Object.keys(files ?? {}).length}:${bg ?? ""}`;
}

interface Props {
  provider: StorageProvider;
  node: FsNode;
  theme: Theme;
  /** Bumped after a successful Google re-auth so pending saves can retry. */
  authEpoch: number;
  onStatus: (s: SaveStatus) => void;
  onAuthExpired: () => void;
  onError: (msg: string) => void;
}

/** One instance per open drawing (parent keys it by file id). */
export function Editor({ provider, node, theme, authEpoch, onStatus, onAuthExpired, onError }: Props) {
  const [initialData, setInitialData] = useState<any>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const latest = useRef<{ elements: Elements; appState: AppState; files: Files } | null>(null);
  const lastSig = useRef<string | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);

  // Keep callbacks fresh without re-creating flush.
  const cb = useRef({ onStatus, onAuthExpired, onError });
  cb.current = { onStatus, onAuthExpired, onError };

  // ---- load ----
  useEffect(() => {
    let cancelled = false;
    provider
      .read(node.id)
      .then((text) => {
        if (cancelled) return;
        const data = text.trim() ? JSON.parse(text) : JSON.parse(EMPTY_DRAWING);
        lastSig.current = signature(data.elements ?? [], data.files, data.appState?.viewBackgroundColor);
        setInitialData({ ...data, scrollToContent: true });
        cb.current.onStatus("saved");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof AuthExpiredError) cb.current.onAuthExpired();
        setLoadError(e instanceof SyntaxError ? "This file isn't a valid Excalidraw drawing." : String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [provider, node.id]);

  // ---- save ----
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current; // never run two writes at once
    if (!dirty.current || !latest.current) return;

    const { elements, appState, files } = latest.current;
    dirty.current = false;
    cb.current.onStatus("saving");

    const p = provider.write(node.id, serializeAsJSON(elements, appState, files, "local"));
    inFlight.current = p.then(
      () => {},
      () => {},
    );
    try {
      await p;
      cb.current.onStatus(dirty.current ? "unsaved" : "saved");
    } catch (e) {
      dirty.current = true;
      cb.current.onStatus("error");
      if (e instanceof AuthExpiredError) cb.current.onAuthExpired();
      else cb.current.onError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = null;
    }
  }, [provider, node.id]);

  const onChange = useCallback<OnChange>(
    (elements, appState, files) => {
      if (lastSig.current === null) return; // not loaded yet
      const sig = signature(elements, files, appState.viewBackgroundColor);
      if (sig === lastSig.current) return;
      lastSig.current = sig;
      latest.current = { elements, appState, files };
      dirty.current = true;
      cb.current.onStatus("unsaved");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Save immediately when switching files / unmounting.
  useEffect(() => () => void flush(), [flush]);

  // Retry after re-auth.
  useEffect(() => {
    if (authEpoch > 0 && dirty.current) void flush();
  }, [authEpoch, flush]);

  // Cmd/Ctrl+S = save now; warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void flush();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush]);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="size-6 text-destructive" />
        <p className="font-medium">Couldn't open “{node.name}”</p>
        <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  if (initialData === undefined) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Opening {node.name}…
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={initialData}
        onChange={onChange}
        theme={theme}
        name={node.name}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  );
}

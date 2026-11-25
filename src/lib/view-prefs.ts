/**
 * Remembers editor state that shouldn't live inside the drawing file:
 * - per drawing: zoom level and scroll position
 * - global: last used tool and its style settings (pencil width, colors, font, ...)
 * Kept in localStorage, so it's per device/browser and never triggers a Drive save.
 */

const VIEW_KEY = (drawingKey: string) => `excalidrive:view:${drawingKey}`;
const TOOL_KEY = "excalidrive:tool-prefs";

export interface SavedView {
  zoom: number;
  scrollX: number;
  scrollY: number;
}

/** Style settings Excalidraw applies to the next shape you draw. */
const STYLE_FIELDS = [
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemStrokeStyle",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "currentItemStartArrowhead",
  "currentItemEndArrowhead",
  "currentItemRoundness",
  "currentItemArrowType",
] as const;

/** Tools that are safe to re-activate on open ("image" would pop a file picker). */
const RESTORABLE_TOOLS = new Set([
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "eraser",
  "hand",
  "frame",
  "laser",
  "lasso",
]);

export interface ToolPrefs {
  tool?: string;
  style: Record<string, unknown>;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: not critical */
  }
}

export function loadView(drawingKey: string): SavedView | null {
  const v = read<SavedView>(VIEW_KEY(drawingKey));
  return v && Number.isFinite(v.zoom) && Number.isFinite(v.scrollX) && Number.isFinite(v.scrollY) ? v : null;
}

export function loadToolPrefs(): ToolPrefs {
  return read<ToolPrefs>(TOOL_KEY) ?? { style: {} };
}

/** appState fields to merge into a drawing's initial state. */
export function initialAppState(drawingKey: string) {
  const view = loadView(drawingKey);
  const prefs = loadToolPrefs();
  return {
    view,
    appState: {
      ...prefs.style,
      ...(view ? { zoom: { value: view.zoom }, scrollX: view.scrollX, scrollY: view.scrollY } : {}),
    },
    tool: prefs.tool && RESTORABLE_TOOLS.has(prefs.tool) ? prefs.tool : undefined,
  };
}

/** Returns a recorder that persists view + tool prefs when they actually change (debounced). */
export function createPrefsRecorder(drawingKey: string) {
  let lastView = "";
  let lastTool = "";
  let timer: number | undefined;
  let pending: (() => void) | null = null;

  const commit = () => {
    pending?.();
    pending = null;
  };

  return {
    record(appState: any) {
      const view: SavedView = {
        zoom: appState.zoom?.value ?? 1,
        scrollX: appState.scrollX ?? 0,
        scrollY: appState.scrollY ?? 0,
      };
      const style: Record<string, unknown> = {};
      for (const f of STYLE_FIELDS) if (appState[f] !== undefined) style[f] = appState[f];
      const tool = appState.activeTool?.type as string | undefined;
      const prefs: ToolPrefs = { tool: tool && RESTORABLE_TOOLS.has(tool) ? tool : undefined, style };

      const viewStr = JSON.stringify(view);
      const toolStr = JSON.stringify(prefs);
      if (viewStr === lastView && toolStr === lastTool) return;

      pending = () => {
        if (viewStr !== lastView) write(VIEW_KEY(drawingKey), view);
        if (toolStr !== lastTool) write(TOOL_KEY, prefs);
        lastView = viewStr;
        lastTool = toolStr;
      };
      window.clearTimeout(timer);
      timer = window.setTimeout(commit, 400);
    },
    /** Write anything pending right away (on close / switching drawings). */
    flush() {
      window.clearTimeout(timer);
      commit();
    },
  };
}

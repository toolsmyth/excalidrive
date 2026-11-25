import { useEffect, useState } from "react";

export const SAVE_DELAYS = [
  { ms: 5_000, label: "5 seconds", short: "5s" },
  { ms: 30_000, label: "30 seconds", short: "30s" },
  { ms: 60_000, label: "1 minute", short: "1m" },
  { ms: 300_000, label: "5 minutes", short: "5m" },
] as const;

const KEY = "excalidrive:save-delay";
const DEFAULT = SAVE_DELAYS[0].ms;

/** How long to wait after the last edit before autosaving. Remembered per browser. */
export function useSaveDelay() {
  const [delay, setDelay] = useState<number>(() => {
    const v = Number(localStorage.getItem(KEY));
    return SAVE_DELAYS.some((d) => d.ms === v) ? v : DEFAULT;
  });
  useEffect(() => localStorage.setItem(KEY, String(delay)), [delay]);
  return [delay, setDelay] as const;
}

/** Ask the open editor to save immediately. */
export const SAVE_NOW_EVENT = "excalidrive:save-now";
export const requestSaveNow = () => window.dispatchEvent(new Event(SAVE_NOW_EVENT));

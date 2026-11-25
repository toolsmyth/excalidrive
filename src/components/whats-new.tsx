import { Fragment, type ReactNode } from "react";
import changelog from "../../CHANGELOG.md?raw";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const APP_VERSION = __APP_VERSION__;

interface Release {
  version: string;
  date: string;
  groups: { title: string; items: string[] }[];
}

/** Parses the "## [x.y.z] - date / ### Group / - item" structure of CHANGELOG.md. */
function parse(md: string): Release[] {
  const releases: Release[] = [];
  for (const line of md.split("\n")) {
    const rel = line.match(/^## \[([^\]]+)\](?:\s*-\s*(.+))?/);
    if (rel) {
      releases.push({ version: rel[1], date: rel[2]?.trim() ?? "", groups: [] });
      continue;
    }
    const cur = releases[releases.length - 1];
    if (!cur) continue;
    const grp = line.match(/^### (.+)/);
    if (grp) {
      cur.groups.push({ title: grp[1].trim(), items: [] });
      continue;
    }
    const item = line.match(/^- (.+)/);
    if (item) {
      if (!cur.groups.length) cur.groups.push({ title: "", items: [] });
      cur.groups[cur.groups.length - 1].items.push(item[1]);
    }
  }
  return releases;
}

const RELEASES = parse(changelog);

/** Renders **bold**, `code` and [links](url) — all the changelog uses. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index} className="font-medium text-foreground">{m[1]}</strong>);
    else if (m[2]) out.push(<code key={m.index} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{m[2]}</code>);
    else out.push(<a key={m.index} href={m[4]} target="_blank" rel="noreferrer" className="underline underline-offset-2">{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const groupTone: Record<string, string> = {
  Added: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Changed: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  Fixed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Removed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

function formatDate(d: string) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function WhatsNewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>You're on version {APP_VERSION}.</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 pb-6">
          {RELEASES.map((r, i) => (
            <section key={r.version} className="border-b py-5 last:border-b-0">
              <div className="mb-3 flex items-baseline gap-2">
                <h3 className="font-semibold">v{r.version}</h3>
                {i === 0 && r.version === APP_VERSION && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">Latest</span>
                )}
                {r.date && <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.date)}</span>}
              </div>
              {r.groups.map((g, gi) => (
                <Fragment key={gi}>
                  {g.title && (
                    <span className={`mt-3 mb-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium first:mt-0 ${groupTone[g.title] ?? "bg-muted text-muted-foreground"}`}>
                      {g.title}
                    </span>
                  )}
                  <ul className="grid gap-1.5 pl-4 text-sm text-muted-foreground [&>li]:list-disc">
                    {g.items.map((it, ii) => (
                      <li key={ii}>{inline(it)}</li>
                    ))}
                  </ul>
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SEEN_KEY = "excalidrive:seen-version";

/** True once after an update for returning users (not on someone's very first visit). */
export function shouldAutoShowWhatsNew(): boolean {
  const seen = localStorage.getItem(SEEN_KEY);
  localStorage.setItem(SEEN_KEY, APP_VERSION);
  return seen !== null && seen !== APP_VERSION;
}

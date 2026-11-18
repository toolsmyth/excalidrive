import { FolderTree, HardDrive, Loader2, Lock, Moon, PenTool, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientId } from "@/lib/storage/google-auth";
import { LoginBackground } from "@/components/login-background";
import type { Theme } from "@/hooks/use-theme";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const features = [
  { icon: FolderTree, title: "Organized", text: "Folders and chapters, as deep as you need." },
  { icon: HardDrive, title: "Your Drive", text: "Drawings are saved as files in your own Google Drive." },
  { icon: Lock, title: "Private", text: "No server in between. Only files this app creates are visible to it." },
];

export function LoginScreen(props: {
  busy: boolean;
  error: string | null;
  theme: Theme;
  onToggleTheme: () => void;
  onGoogle: () => void;
  onLocal: () => void;
}) {
  const hasClientId = !!getClientId();
  return (
    <div className="dot-grid relative flex min-h-full items-center justify-center overflow-hidden bg-background p-6">
      <LoginBackground />
      <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-10" onClick={props.onToggleTheme} aria-label="Toggle theme">
        {props.theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl">
        <div className="p-6 pb-5">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <PenTool className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Excalidrive</h1>
              <p className="mt-1 text-sm text-muted-foreground">Excalidraw boards, organized in folders, stored in your Google Drive.</p>
            </div>
          </div>

          <div className="grid gap-3">
            <Button size="lg" variant="outline" disabled={!hasClientId || props.busy} onClick={props.onGoogle}>
              {props.busy ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
              Connect Google Drive
            </Button>
            {!hasClientId && import.meta.env.DEV && (
              <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Dev note:</span> Drive is off because{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">VITE_GOOGLE_CLIENT_ID</code> isn't set in{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code>. See the README.
              </p>
            )}
            {props.error && <p className="text-sm text-destructive">{props.error}</p>}

            <div className="relative my-1 text-center text-xs text-muted-foreground after:absolute after:inset-0 after:top-1/2 after:z-0 after:border-t">
              <span className="relative z-10 bg-card px-2">or</span>
            </div>

            <Button variant="ghost" onClick={props.onLocal}>
              Skip for now, save on this device
            </Button>
            <p className="-mt-1 text-center text-xs text-muted-foreground">
              Files stay in this browser. Connect Google Drive anytime to sync them.
            </p>
          </div>
        </div>

        <ul className="grid gap-2.5 border-t bg-muted/50 px-6 py-4">
          {features.map((f) => (
            <li key={f.title} className="flex items-start gap-2.5 text-xs">
              <f.icon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium">{f.title}.</span> <span className="text-muted-foreground">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="absolute bottom-4 left-0 z-10 flex w-full justify-center gap-4 text-xs text-muted-foreground">
        <a href="./privacy.html" className="hover:text-foreground hover:underline">Privacy</a>
        <a href="./terms.html" className="hover:text-foreground hover:underline">Terms</a>
        <a href="https://github.com/toolsmyth/excalidrive" className="hover:text-foreground hover:underline">GitHub</a>
      </footer>
    </div>
  );
}

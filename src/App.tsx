import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LoginScreen } from "@/components/login-screen";
import { Workspace } from "@/components/workspace";
import { useTheme } from "@/hooks/use-theme";
import { getStoredToken, requestGoogleToken } from "@/lib/storage/google-auth";
import { GoogleDriveProvider } from "@/lib/storage/google-drive";
import { LocalProvider } from "@/lib/storage/local";
import type { StorageProvider } from "@/lib/storage/types";

const MODE_KEY = "excalidrive:mode";

export default function App() {
  const { theme, toggle } = useTheme();
  const [provider, setProvider] = useState<StorageProvider | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the previous session (Google token from this tab, or local demo mode).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mode = localStorage.getItem(MODE_KEY);
      const token = getStoredToken();
      try {
        if (mode === "google" && token) {
          const p = await GoogleDriveProvider.connect(token);
          if (!cancelled) setProvider(p);
        } else if (mode === "local") {
          setProvider(new LocalProvider());
        }
      } catch {
        /* token no longer valid — show login */
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await requestGoogleToken({ prompt: "select_account" });
      const p = await GoogleDriveProvider.connect(token);
      localStorage.setItem(MODE_KEY, "google");
      setProvider(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const useLocal = useCallback(() => {
    localStorage.setItem(MODE_KEY, "local");
    setProvider(new LocalProvider());
  }, []);

  const signOut = useCallback(() => {
    provider?.signOut();
    localStorage.removeItem(MODE_KEY);
    setProvider(null);
  }, [provider]);

  if (booting) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!provider) {
    return (
      <LoginScreen
        busy={busy}
        error={error}
        theme={theme}
        onToggleTheme={toggle}
        onGoogle={signInWithGoogle}
        onLocal={useLocal}
      />
    );
  }

  return <Workspace provider={provider} theme={theme} onToggleTheme={toggle} onSignOut={signOut} />;
}

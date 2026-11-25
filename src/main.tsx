import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./index.css";

// Service worker: makes the app installable and loadable offline (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);

// Service worker: makes the app installable + usable offline (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

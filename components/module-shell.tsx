"use client";

import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type Audience = "management" | "input";

type ModuleShellProps = {
  audience: Audience;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onSync?: () => void;
  syncBusy?: boolean;
};

const portalUrls: Record<Audience, string> = {
  management: process.env.NEXT_PUBLIC_MANAGEMENT_PORTAL_URL || "https://palm-digital.vercel.app/hub/manager/",
  input: process.env.NEXT_PUBLIC_INPUT_PORTAL_URL || "https://palm-digital.vercel.app/hub/worker/",
};

export function ModuleShell({ audience, title, subtitle, children, onSync, syncBusy = false }: ModuleShellProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(window.navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  const goBackToPortal = () => {
    window.location.assign(portalUrls[audience]);
  };

  return (
    <div className="module-shell">
      <header className="module-header">
        <div className="module-header-main">
          <button className="back-button" type="button" onClick={goBackToPortal}>
            <ArrowLeft aria-hidden="true" size={18} />
            <span>Back to Portal</span>
          </button>
          <div>
            <p className="eyebrow">Digital Estate</p>
            <h1>{title}</h1>
            <p className="module-subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="module-status" aria-live="polite">
          {isOnline ? <Wifi aria-hidden="true" size={18} /> : <WifiOff aria-hidden="true" size={18} />}
          <span>{isOnline ? "Online" : "Offline"}</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Sync pending changes"
            title="Sync pending changes"
            onClick={onSync}
            disabled={!onSync || syncBusy}
          >
            <RefreshCw aria-hidden="true" className={syncBusy ? "spin" : ""} size={18} />
          </button>
        </div>
      </header>
      <main className="module-content">{children}</main>
    </div>
  );
}

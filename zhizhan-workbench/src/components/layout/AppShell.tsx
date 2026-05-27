"use client";

import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import ToastContainer from "@/components/common/ToastContainer";
import { useAppStore } from "@/store";
import { checkPythonHealth } from "@/lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const setPythonOnline = useAppStore((s) => s.setPythonOnline);

  useEffect(() => {
    const check = async () => {
      const online = await checkPythonHealth();
      setPythonOnline(online);
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [setPythonOnline]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <ToastContainer />
    </div>
  );
}

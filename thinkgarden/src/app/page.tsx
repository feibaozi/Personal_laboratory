"use client";

import { useState, useCallback } from "react";
import TitleBar from "@/components/TitleBar";
import Sidebar from "@/components/Sidebar";
import MindMap from "@/components/framework/MindMap";
import Settings from "@/components/Settings";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [frameworkKey, setFrameworkKey] = useState(0);

  const handleFrameworkChange = useCallback(() => {
    setFrameworkKey((k) => k + 1);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          onFrameworkChange={handleFrameworkChange}
          onFrameworkCreated={handleFrameworkChange}
        />
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <MindMap key={frameworkKey} />
        </main>
      </div>
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

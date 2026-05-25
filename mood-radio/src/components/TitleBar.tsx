"use client";

import { useState, useEffect, useCallback } from "react";

export default function TitleBar() {
  const [isTop, setIsTop] = useState(false);

  const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI?.getIsAlwaysOnTop().then(setIsTop);
  }, [isElectron]);

  if (!isElectron) return null;

  const handleToggleTop = useCallback(() => {
    window.electronAPI?.toggleAlwaysOnTop();
    setIsTop((prev) => !prev);
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow();
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow();
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-end px-4 py-3 cursor-default"
      style={{ WebkitAppRegion: "drag" as any }}
    >
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" as any }}
      >
        <button
          onClick={handleToggleTop}
          className={`w-3 h-3 rounded-full transition-all duration-200 ${
            isTop
              ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]"
              : "bg-white/20 hover:bg-blue-400/60"
          }`}
          title={isTop ? "取消置顶" : "置顶"}
        />
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-white/20 hover:bg-yellow-400 transition-all duration-200"
          title="最小化"
        />
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-white/20 hover:bg-red-400 transition-all duration-200"
          title="关闭"
        />
      </div>
    </div>
  );
}
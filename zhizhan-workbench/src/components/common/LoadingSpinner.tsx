"use client";

export default function LoadingSpinner({ message = "加载中..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-text-secondary">{message}</span>
      </div>
    </div>
  );
}

export function LoadingSpinner({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="dot-loader">
        <span />
        <span />
        <span />
      </div>
      <span className="text-sm text-slate-400 font-medium">{text}</span>
    </div>
  );
}

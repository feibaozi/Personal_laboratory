import { useState, useEffect } from 'react';

interface Props {
  path: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function LocalImage({ path, alt = '', className, style }: Props) {
  const [src, setSrc] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!path) {
      setError('no path');
      return;
    }
    let cancelled = false;

    console.log('[LocalImage] loading:', path);

    window.electronAPI.readImageDataUrl(path).then((dataUrl) => {
      if (cancelled) return;
      if (dataUrl) {
        console.log('[LocalImage] loaded ok, size:', dataUrl.length);
        setSrc(dataUrl);
      } else {
        console.error('[LocalImage] got null/empty dataUrl for:', path);
        setError('empty response');
      }
    }).catch((err) => {
      if (cancelled) return;
      console.error('[LocalImage] IPC error:', err);
      setError(String(err));
    });

    return () => { cancelled = true; };
  }, [path]);

  if (error) {
    return (
      <div className={`bg-red-50 flex items-center justify-center ${className || ''}`} style={style}>
        <span className="text-red-400 text-[10px] text-center p-1">{error}</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className || ''}`} style={style}>
        <span className="text-gray-300 text-xs">加载中...</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} style={style} />;
}

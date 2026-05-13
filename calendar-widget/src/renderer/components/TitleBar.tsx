import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props { children?: ReactNode; }

export function TitleBar({ children }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span style={{ color: '#7dcc9a', fontFamily: 'var(--font-system-family)', fontSize: 'var(--font-system-size)' }}>
        {t('app.title')}
      </span>
      <div className="flex gap-2 items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {children}
        <button onClick={() => window.electronAPI.minimizeWindow()}
          className="text-sm w-6 h-6 flex items-center justify-center rounded transition-colors"
          style={{ color: '#5a8a6e', background: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#7dcc9a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#5a8a6e')}>&#x2014;</button>
        <button onClick={() => window.electronAPI.closeWindow()}
          className="text-sm w-6 h-6 flex items-center justify-center rounded transition-colors"
          style={{ color: '#5a8a6e', background: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#c0392b')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#5a8a6e')}>&#x2715;</button>
      </div>
    </div>
  );
}

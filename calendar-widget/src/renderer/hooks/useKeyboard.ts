import { useEffect } from 'react';

type KeyHandler = Record<string, () => void>;

export function useKeyboard(handlers: KeyHandler) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey && 'Ctrl',
        e.metaKey && 'Meta',
        e.shiftKey && 'Shift',
        e.key,
      ]
        .filter(Boolean)
        .join('+');

      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers]);
}

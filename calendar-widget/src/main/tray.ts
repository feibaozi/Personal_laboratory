import { Tray, Menu, nativeImage, app } from 'electron';
import { getMainWindow } from './window';
import path from 'path';

let tray: Tray | null = null;

export function createTray(): void {
  // Create a simple 16x16 visible tray icon (green calendar indicator)
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 125;     // R
    buffer[i + 1] = 204; // G
    buffer[i + 2] = 154; // B
    buffer[i + 3] = 255; // A
  }
  const icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.isVisible() ? win.hide() : win.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Calendar Widget');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) {
      win.isVisible() ? win.focus() : win.show();
    }
  });
}

import { BrowserWindow, screen } from 'electron';
import { getMainWindow } from './window';

const WIDTH = 340;
const HEIGHT = 140;
const MARGIN = 20;
const AUTO_CLOSE_MS = 8000;

export function showNotificationWindow(
  todo: { title: string; startTime: string; endTime: string; categoryName?: string },
  leadMinutes: number,
): void {
  const primary = screen.getPrimaryDisplay();
  const { x: screenX, y: screenY, width: screenW, height: screenH } = primary.workArea;

  const x = screenX + screenW - WIDTH - MARGIN;
  const y = screenY + screenH - HEIGHT - MARGIN;

  const html = buildNotificationHtml(todo, leadMinutes);

  const win = new BrowserWindow({
    x,
    y,
    width: WIDTH,
    height: HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  win.once('ready-to-show', () => {
    win.show();
  });

  // Auto-close after timeout
  const timer = setTimeout(() => {
    if (!win.isDestroyed()) win.close();
  }, AUTO_CLOSE_MS);

  // Handle button clicks via console message (simple IPC-free approach)
  win.webContents.on('console-message', (_event, _level, message) => {
    if (message === '__dismiss__') {
      clearTimeout(timer);
      if (!win.isDestroyed()) win.close();
    }
    if (message === '__view__') {
      clearTimeout(timer);
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        if (mainWin.isMinimized()) mainWin.restore();
        if (!mainWin.isVisible()) mainWin.show();
        mainWin.focus();
      }
      if (!win.isDestroyed()) win.close();
    }
  });
}

function buildNotificationHtml(
  todo: { title: string; startTime: string; endTime: string; categoryName?: string },
  leadMinutes: number,
): string {
  const title = escapeHtml(todo.title || '无标题');
  const timeRange = `${todo.startTime} - ${todo.endTime}`;
  const category = todo.categoryName ? ` · ${escapeHtml(todo.categoryName)}` : '';
  const leadText = leadMinutes <= 1 ? '即将开始' : `将在 ${leadMinutes} 分钟后开始`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Microsoft YaHei', sans-serif;
    font-size: 13px;
    background: transparent;
    user-select: none;
    -webkit-app-region: no-drag;
  }
  .panel {
    margin: 8px;
    padding: 16px 18px;
    background: rgba(16,28,20,0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    border: 1px solid rgba(120,200,145,0.15);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .header {
    font-size: 11px;
    color: #5a8a6e;
    margin-bottom: 8px;
  }
  .title {
    font-size: 15px;
    color: #00e5ff;
    font-weight: 500;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    font-size: 12px;
    color: #7dcc9a;
    margin-bottom: 6px;
  }
  .meta {
    font-size: 11px;
    color: #5a8a6e;
    margin-bottom: 14px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    padding: 5px 16px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    border: none;
    outline: none;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-dismiss {
    background: transparent;
    color: #5a8a6e;
  }
  .btn-dismiss:hover {
    background: rgba(120,200,145,0.1);
    color: #7dcc9a;
  }
  .btn-view {
    background: #3b9e6d;
    color: #fff;
  }
  .btn-view:hover {
    background: #4ab87f;
  }
</style>
</head>
<body>
<div class="panel">
  <div class="header">📅 日历待办</div>
  <div class="title">⏰ ${title}</div>
  <div class="subtitle">${leadText}</div>
  <div class="meta">${timeRange}${category}</div>
  <div class="actions">
    <button class="btn btn-dismiss" onclick="console.log('__dismiss__')">知道了</button>
    <button class="btn btn-view" onclick="console.log('__view__')">查看详情</button>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

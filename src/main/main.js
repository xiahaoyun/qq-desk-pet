import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, powerMonitor, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Store from 'electron-store';

const appName = 'QQ';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const store = new Store({ name: 'qq-desk-pet' });

let mainWindow;
let tray;
let wanderTimer;
let walkAnimationTimer;
let currentAction = 'idle';
let sleepUntil = 0;

const sleepDuration = 15 * 60 * 1000;
const windowSize = {
  width: 360,
  height: 360
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function createIcon() {
  const imagePath = path.join(__dirname, '../../build/icon.png');
  const image = nativeImage.createFromPath(imagePath);
  if (!image.isEmpty()) return image.resize({ width: 22, height: 22 });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#f2ebe1"/>
      <path d="M17 34c1-11 9-19 20-18 11 2 17 11 14 22-3 10-12 17-24 14-8-2-12-9-10-18z" fill="#f8f5ed"/>
      <path d="M18 32c5-9 15-14 28-8 3 4 5 8 4 13-5-6-11-8-19-6-6 1-10 3-13 1z" fill="#2f342c"/>
      <path d="M15 19l9 7 3-13M48 18l-10 8-3-13" fill="#2f342c" stroke="#2f342c" stroke-linejoin="round"/>
      <circle cx="27" cy="34" r="4" fill="#6f7e28"/>
      <circle cx="42" cy="34" r="4" fill="#6f7e28"/>
      <path d="M34 39l3 2-3 2-3-2z" fill="#28231f"/>
      <path d="M30 47c4 3 9 3 13 0" fill="none" stroke="#5d5147" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function getFallbackBounds() {
  const display = screen.getPrimaryDisplay();
  return {
    ...windowSize,
    displayId: display.id,
    x: Math.round(display.workArea.x + display.workArea.width - windowSize.width - 48),
    y: Math.round(display.workArea.y + display.workArea.height - windowSize.height - 48)
  };
}

function createWindow() {
  const savedBounds = store.get('bounds');
  const fallbackBounds = getFallbackBounds();
  const initialBounds = resolveInitialBounds(savedBounds, fallbackBounds);

  mainWindow = new BrowserWindow({
    ...toWindowBounds(initialBounds),
    minWidth: 260,
    minHeight: 260,
    maxWidth: 520,
    maxHeight: 520,
    transparent: true,
    frame: false,
    resizable: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadURL(isDev ? 'http://127.0.0.1:5173' : `file://${path.join(__dirname, '../../dist/index.html')}`);

  mainWindow.on('move', saveBounds);
  mainWindow.on('resize', saveBounds);
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

function resolveInitialBounds(savedBounds, fallbackBounds) {
  if (!savedBounds) return fallbackBounds;

  const width = clamp(Math.round(savedBounds.width || fallbackBounds.width), 260, 520);
  const height = clamp(Math.round(savedBounds.height || fallbackBounds.height), 260, 520);
  const displays = screen.getAllDisplays();
  const savedDisplay = displays.find(display => display.id === savedBounds.displayId);
  const intersectingDisplay = displays.find(display => boundsIntersectWorkArea(savedBounds, { width, height }, display.workArea));
  const matchingDisplay = savedDisplay || intersectingDisplay;

  const workArea = (matchingDisplay || screen.getPrimaryDisplay()).workArea;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    width,
    height,
    displayId: matchingDisplay?.id,
    x: clamp(Math.round(savedBounds.x ?? fallbackBounds.x), workArea.x, maxX),
    y: clamp(Math.round(savedBounds.y ?? fallbackBounds.y), workArea.y, maxY)
  };
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  store.set('bounds', { ...bounds, displayId: display.id });
}

function toWindowBounds(bounds) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function boundsIntersectWorkArea(bounds, size, workArea) {
  return (
    bounds.x < workArea.x + workArea.width &&
    bounds.x + size.width > workArea.x &&
    bounds.y < workArea.y + workArea.height &&
    bounds.y + size.height > workArea.y
  );
}

function resetWindowPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();

  const fallbackBounds = getFallbackBounds();
  mainWindow.setBounds(toWindowBounds(fallbackBounds));
  saveBounds();
  showMainWindow();
}

function keepWindowInVisibleWorkArea() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = resolveInitialBounds(mainWindow.getBounds(), getFallbackBounds());
  mainWindow.setBounds(toWindowBounds(bounds));
  saveBounds();
}

function showMainWindow({ focus = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();

  keepWindowInVisibleWorkArea();
  mainWindow.setAlwaysOnTop(true);

  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible() && !focus) {
    mainWindow.showInactive();
  } else {
    mainWindow.show();
  }

  if (focus) mainWindow.focus();
}

function updateActionState(action) {
  currentAction = action;
  if (action === 'sleep') {
    sleepUntil = Date.now() + sleepDuration;
  } else {
    sleepUntil = 0;
  }
}

function sendAction(action, options = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    updateActionState(action);
    mainWindow.webContents.send('pet-action', action, options);
    if (!mainWindow.isVisible()) showMainWindow();
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function chooseWanderTarget(bounds, workArea) {
  const maxX = workArea.x + workArea.width - bounds.width;
  const maxY = workArea.y + workArea.height - bounds.height;
  const minStep = 140;
  const distance = 180 + Math.random() * 260;
  const canMoveLeft = bounds.x - workArea.x > minStep;
  const canMoveRight = maxX - bounds.x > minStep;
  let direction = Math.random() > 0.5 ? 1 : -1;

  if (!canMoveLeft && canMoveRight) direction = 1;
  if (!canMoveRight && canMoveLeft) direction = -1;

  const x = clamp(Math.round(bounds.x + distance * direction), workArea.x, maxX);
  const yDrift = Math.round((Math.random() - 0.5) * 90);
  const y = clamp(bounds.y + yDrift, workArea.y, maxY);
  return { x, y, direction: x >= bounds.x ? 'right' : 'left' };
}

function wanderOnce() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  if (currentAction === 'sleep' || Date.now() < sleepUntil) return;

  const bounds = mainWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const target = chooseWanderTarget(bounds, workArea);
  const start = { x: bounds.x, y: bounds.y };
  const duration = 4200;
  const startedAt = Date.now();

  sendAction('walk', { direction: target.direction });
  clearInterval(walkAnimationTimer);
  walkAnimationTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(walkAnimationTimer);
      return;
    }

    const progress = clamp((Date.now() - startedAt) / duration, 0, 1);
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
    mainWindow.setBounds({
      x: Math.round(start.x + (target.x - start.x) * ease),
      y: Math.round(start.y + (target.y - start.y) * ease),
      width: bounds.width,
      height: bounds.height
    });

    if (progress >= 1) {
      clearInterval(walkAnimationTimer);
      saveBounds();
      sendAction('idle');
    }
  }, 16);
}

function startWandering() {
  clearInterval(wanderTimer);
  wanderTimer = setInterval(wanderOnce, 22000);
  setTimeout(wanderOnce, 3500);
}

function createTray() {
  if (tray) return;

  tray = new Tray(createIcon());
  tray.setToolTip(appName);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '待机', click: () => sendAction('idle') },
    { label: '走动', click: () => sendAction('walk') },
    { label: '坐下', click: () => sendAction('sit') },
    { label: '跳跃', click: () => sendAction('jump') },
    { label: '打招呼', click: () => sendAction('wave') },
    { label: '睡觉', click: () => sendAction('sleep') },
    { type: 'separator' },
    { label: '显示/隐藏', click: () => mainWindow?.isVisible() ? mainWindow.hide() : showMainWindow() },
    { label: '重置位置', click: () => resetWindowPosition() },
    { label: '退出', click: () => app.quit() }
  ]));
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    app.setName(appName);
    createWindow();
    createTray();
    startWandering();

    powerMonitor.on('resume', () => {
      setTimeout(() => {
        showMainWindow({ focus: false });
      }, 800);
    });
  });
}

app.on('window-all-closed', event => {
  event.preventDefault();
});

app.on('activate', () => {
  showMainWindow();
});

ipcMain.on('pet-action', (_event, action) => sendAction(action));
ipcMain.on('pet-state', (_event, action) => updateActionState(action));
ipcMain.on('pet-close', () => app.quit());

import { app } from 'electron';
import path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const userDataPath = app.getPath('userData');
const imagesDir = path.join(userDataPath, 'wardrobe-stylist', 'images');
const originalDir = path.join(imagesDir, 'original');
const thumbnailDir = path.join(imagesDir, 'thumbnail');
const stickerDir = path.join(imagesDir, 'sticker');

function ensureDirs() {
  [imagesDir, originalDir, thumbnailDir, stickerDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function runPython(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Python exit ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function importImage(sourcePath: string): Promise<{
  original: string;
  thumbnail: string;
  sticker: string | null;
  colors: string[];
}> {
  ensureDirs();
  const id = uuidv4();
  const ext = path.extname(sourcePath) || '.jpg';
  const originalName = `${id}${ext}`;

  const originalDest = path.join(originalDir, originalName);
  const thumbnailDest = path.join(thumbnailDir, originalName);

  fs.copyFileSync(sourcePath, originalDest);
  fs.copyFileSync(sourcePath, thumbnailDest);

  // Try Python OpenCV background removal
  let sticker: string | null = null;
  let colors: string[] = [];
  try {
    const scriptPath = path.join(app.getAppPath(), 'scripts', 'process_image.py');
    // Fallback for dev: try multiple paths
    const altPaths = [
      scriptPath,
      path.join(__dirname, '../../../scripts/process_image.py'),
      path.join(process.cwd(), 'scripts/process_image.py'),
    ];
    let actualPath = scriptPath;
    for (const p of altPaths) {
      if (fs.existsSync(p)) { actualPath = p; break; }
    }

    const result = await runPython(actualPath, [originalDest, stickerDir]);
    const data = JSON.parse(result);
    if (data.success && data.stickerPath && fs.existsSync(data.stickerPath)) {
      sticker = data.stickerPath;
      colors = data.colors || [];
    }
  } catch (e) {
    console.error('[image-service] Python processing failed:', e);
  }

  return { original: originalDest, thumbnail: thumbnailDest, sticker, colors };
}

export async function removeBackground(imagePath: string): Promise<string | null> {
  try {
    const scriptPath = path.join(app.getAppPath(), 'scripts', 'process_image.py');
    const altPaths = [
      scriptPath,
      path.join(__dirname, '../../../scripts/process_image.py'),
      path.join(process.cwd(), 'scripts/process_image.py'),
    ];
    let actualPath = scriptPath;
    for (const p of altPaths) {
      if (fs.existsSync(p)) { actualPath = p; break; }
    }

    const result = await runPython(actualPath, [imagePath, stickerDir]);
    const data = JSON.parse(result);
    if (data.success && data.stickerPath) return data.stickerPath;
    return null;
  } catch (e) {
    console.error('[image-service] removeBackground failed:', e);
    return null;
  }
}

export function getTemplatePath(templateId: string): string {
  const possiblePaths = [
    path.join(__dirname, '../../../resources/templates', `${templateId}.png`),
    path.join(app.getAppPath(), 'resources/templates', `${templateId}.png`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

export function getTemplateList(): string[] {
  const templates = [
    'male-slim', 'male-standard', 'male-athletic',
    'female-petite', 'female-standard', 'female-curvy',
  ];
  return templates.filter((t) => getTemplatePath(t) !== '');
}

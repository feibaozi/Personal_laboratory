"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importImage = importImage;
exports.removeBackground = removeBackground;
exports.getTemplatePath = getTemplatePath;
exports.getTemplateList = getTemplateList;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
const userDataPath = electron_1.app.getPath('userData');
const imagesDir = path_1.default.join(userDataPath, 'wardrobe-stylist', 'images');
const originalDir = path_1.default.join(imagesDir, 'original');
const thumbnailDir = path_1.default.join(imagesDir, 'thumbnail');
const stickerDir = path_1.default.join(imagesDir, 'sticker');
function ensureDirs() {
    [imagesDir, originalDir, thumbnailDir, stickerDir].forEach((dir) => {
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
    });
}
function runPython(scriptPath, args) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('python', [scriptPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code === 0)
                resolve(stdout.trim());
            else
                reject(new Error(stderr || `Python exit ${code}`));
        });
        proc.on('error', reject);
    });
}
async function importImage(sourcePath) {
    ensureDirs();
    const id = (0, uuid_1.v4)();
    const ext = path_1.default.extname(sourcePath) || '.jpg';
    const originalName = `${id}${ext}`;
    const originalDest = path_1.default.join(originalDir, originalName);
    const thumbnailDest = path_1.default.join(thumbnailDir, originalName);
    fs.copyFileSync(sourcePath, originalDest);
    fs.copyFileSync(sourcePath, thumbnailDest);
    // Try Python OpenCV background removal
    let sticker = null;
    let colors = [];
    try {
        const scriptPath = path_1.default.join(electron_1.app.getAppPath(), 'scripts', 'process_image.py');
        // Fallback for dev: try multiple paths
        const altPaths = [
            scriptPath,
            path_1.default.join(__dirname, '../../../scripts/process_image.py'),
            path_1.default.join(process.cwd(), 'scripts/process_image.py'),
        ];
        let actualPath = scriptPath;
        for (const p of altPaths) {
            if (fs.existsSync(p)) {
                actualPath = p;
                break;
            }
        }
        const result = await runPython(actualPath, [originalDest, stickerDir]);
        const data = JSON.parse(result);
        if (data.success && data.stickerPath && fs.existsSync(data.stickerPath)) {
            sticker = data.stickerPath;
            colors = data.colors || [];
        }
    }
    catch (e) {
        console.error('[image-service] Python processing failed:', e);
    }
    return { original: originalDest, thumbnail: thumbnailDest, sticker, colors };
}
async function removeBackground(imagePath) {
    try {
        const scriptPath = path_1.default.join(electron_1.app.getAppPath(), 'scripts', 'process_image.py');
        const altPaths = [
            scriptPath,
            path_1.default.join(__dirname, '../../../scripts/process_image.py'),
            path_1.default.join(process.cwd(), 'scripts/process_image.py'),
        ];
        let actualPath = scriptPath;
        for (const p of altPaths) {
            if (fs.existsSync(p)) {
                actualPath = p;
                break;
            }
        }
        const result = await runPython(actualPath, [imagePath, stickerDir]);
        const data = JSON.parse(result);
        if (data.success && data.stickerPath)
            return data.stickerPath;
        return null;
    }
    catch (e) {
        console.error('[image-service] removeBackground failed:', e);
        return null;
    }
}
function getTemplatePath(templateId) {
    const possiblePaths = [
        path_1.default.join(__dirname, '../../../resources/templates', `${templateId}.png`),
        path_1.default.join(electron_1.app.getAppPath(), 'resources/templates', `${templateId}.png`),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p))
            return p;
    }
    return '';
}
function getTemplateList() {
    const templates = [
        'male-slim', 'male-standard', 'male-athletic',
        'female-petite', 'female-standard', 'female-curvy',
    ];
    return templates.filter((t) => getTemplatePath(t) !== '');
}
//# sourceMappingURL=image-service.js.map
import { resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

let nativeEngine: any = null;

function loadEngine(): any {
  if (nativeEngine) return nativeEngine;

  const possiblePaths = [
    resolve(__dirname, '../../engine/codebase-engine.win32-x64-msvc.node'),
    resolve(__dirname, '../../engine/codebase-engine.linux-x64-gnu.node'),
    resolve(__dirname, '../../engine/codebase-engine.darwin-x64.node'),
    resolve(__dirname, '../../engine/codebase-engine.darwin-arm64.node'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      nativeEngine = require(p);
      return nativeEngine;
    }
  }

  throw new Error(
    'Native engine module not found. Run "cd packages/engine && npm run build" first.'
  );
}

export interface AnalyzeResult {
  projectId: string;
  graphJson: string;
  duplicationsJson: string | null;
  nodeCount: number;
  edgeCount: number;
}

export function analyzeProject(projectPath: string): AnalyzeResult {
  const engine = loadEngine();
  return engine.analyzeProject({
    projectPath,
    languages: [],
    incremental: false,
  });
}

export function traceLineage(
  graphJson: string,
  symbolName: string,
  maxDepth: number = 5
) {
  const engine = loadEngine();
  const resultJson = engine.traceLineage({
    graphJson,
    symbolName,
    maxDepth,
  });
  return JSON.parse(resultJson);
}

export function detectCycles(graphJson: string) {
  const engine = loadEngine();
  return JSON.parse(engine.detectCycles(graphJson));
}

export function computeDebtMetrics(
  graphJson: string,
  testCoverage?: number,
  duplicationRate?: number
) {
  const engine = loadEngine();
  return JSON.parse(
    engine.computeDebtMetrics(
      graphJson,
      testCoverage ?? null,
      duplicationRate ?? null
    )
  );
}

export function detectSmells(graphJson: string) {
  const engine = loadEngine();
  const [smells, tasks] = JSON.parse(engine.detectSmells(graphJson));
  return { smells, tasks };
}
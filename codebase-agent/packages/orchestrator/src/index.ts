import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import {
  analyzeProject,
  traceLineage,
  computeDebtMetrics,
  detectSmells,
} from './engine-service.js';
import { generateArchitectureDocs, generateArchitectureDocsSync } from './docs-service.js';

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8')
);

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(websocket);

interface CachedAnalysis {
  projectId: string;
  projectPath: string;
  graphJson: string;
  duplicationsJson: string | null;
  docsContent: string | null;
  nodeCount: number;
  edgeCount: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const analysisCache = new Map<string, CachedAnalysis>();

let engineAvailable = false;

function tryLoadEngine(): boolean {
  const candidates = [
    resolve(import.meta.dirname, '../../engine/codebase-engine.win32-x64-msvc.node'),
    resolve(import.meta.dirname, '../../engine/codebase-engine.linux-x64-gnu.node'),
    resolve(import.meta.dirname, '../../engine/codebase-engine.darwin-x64.node'),
    resolve(import.meta.dirname, '../../engine/codebase-engine.darwin-arm64.node'),
  ];
  return candidates.some(p => existsSync(p));
}

engineAvailable = tryLoadEngine();

fastify.get('/api/health', async () => {
  return { status: 'ok', version: pkg.version, engineAvailable };
});

fastify.post('/api/analyze', async (request, reply) => {
  const { projectPath, languages, incremental } = request.body as {
    projectPath: string;
    languages?: string[];
    incremental?: boolean;
  };

  if (!projectPath) {
    return reply.status(400).send({ error: 'projectPath is required' });
  }

  const projectId = uuidv4();

  if (!engineAvailable) {
    analysisCache.set(projectId, {
      projectId,
      projectPath,
      graphJson: '{"nodes":[],"edges":[]}',
      duplicationsJson: null,
      docsContent: null,
      nodeCount: 0,
      edgeCount: 0,
      status: 'error',
      error: 'Native engine not available. Build it with: cd packages/engine && npm run build',
    });
    return { projectId, status: 'error', message: 'Engine not built yet' };
  }

  analysisCache.set(projectId, {
      projectId,
      projectPath,
      graphJson: '',
      duplicationsJson: null,
      docsContent: null,
      nodeCount: 0,
      edgeCount: 0,
      status: 'running',
      startedAt: new Date().toISOString(),
    });

  try {
    const result = analyzeProject(projectPath);
    analysisCache.set(projectId, {
      projectId,
      projectPath,
      graphJson: result.graphJson,
      duplicationsJson: result.duplicationsJson,
      docsContent: null,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
      status: 'completed',
      startedAt: analysisCache.get(projectId)!.startedAt,
      completedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    analysisCache.set(projectId, {
      projectId,
      projectPath,
      graphJson: '{"nodes":[],"edges":[]}',
      duplicationsJson: null,
      docsContent: null,
      nodeCount: 0,
      edgeCount: 0,
      status: 'error',
      error: err.message,
    });
  }

  return { projectId, status: analysisCache.get(projectId)!.status };
});

fastify.get('/api/projects/:id/graph', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);

  if (!cached) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  if (cached.status === 'error') {
    return reply.status(500).send({ error: cached.error });
  }

  if (!cached.graphJson || cached.graphJson === '{"nodes":[],"edges":[]}') {
    return { nodes: [], edges: [] };
  }

  return JSON.parse(cached.graphJson);
});

fastify.get('/api/projects/:id/lineage', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { symbol } = request.query as { symbol: string };

  if (!symbol) {
    return reply.status(400).send({ error: 'symbol query parameter is required' });
  }

  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (!cached.graphJson) return { symbol, downstream: [], upstream: [] };

  return traceLineage(cached.graphJson, symbol);
});

fastify.get('/api/projects/:id/debt', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (!cached.graphJson) return { overall: 0, grade: 'N/A', dimensions: {} };
  return computeDebtMetrics(cached.graphJson);
});

fastify.get('/api/projects/:id/duplications', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (cached.duplicationsJson) {
    return { projectId: id, groups: JSON.parse(cached.duplicationsJson) };
  }
  return { projectId: id, groups: [] };
});

fastify.get('/api/projects/:id/refactor-suggestions', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (!cached.graphJson) return { smells: [], tasks: [] };
  return detectSmells(cached.graphJson);
});

fastify.post('/api/projects/:id/docs/generate', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (!cached.graphJson) return reply.status(400).send({ error: 'No graph data available' });

  try {
    const debt = await computeDebtMetrics(cached.graphJson);
    const debtData = Array.isArray(debt) ? debt[0] : debt;
    const content = await generateArchitectureDocsSync(cached.graphJson, debtData);
    cached.docsContent = content;
    return { projectId: id, status: 'completed', content };
  } catch (err: any) {
    return reply.status(500).send({ error: `LLM generation failed: ${err.message}` });
  }
});

fastify.get('/api/projects/:id/docs/stream', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (!cached.graphJson) return reply.status(400).send({ error: 'No graph data available' });

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    const debt = await computeDebtMetrics(cached.graphJson);
    const debtData = Array.isArray(debt) ? debt[0] : debt;
    let fullContent = '';

    for await (const chunk of generateArchitectureDocs(cached.graphJson, debtData)) {
      fullContent += chunk;
      reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    cached.docsContent = fullContent;
    reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    reply.raw.end();
  } catch (err: any) {
    reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    reply.raw.end();
  }
});

fastify.get('/api/projects/:id/docs', async (request, reply) => {
  const { id } = request.params as { id: string };
  const cached = analysisCache.get(id);
  if (!cached) return reply.status(404).send({ error: 'Not found' });
  if (cached.docsContent) {
    return { projectId: id, content: cached.docsContent };
  }
  return { projectId: id, content: null };
});

fastify.get('/api/status/:projectId', async (request, reply) => {
  const { projectId } = request.params as { projectId: string };
  const cached = analysisCache.get(projectId);

  if (!cached) {
    return reply.status(404).send({ error: 'Analysis not found' });
  }

  return {
    projectId: cached.projectId,
    status: cached.status,
    nodeCount: cached.nodeCount,
    edgeCount: cached.edgeCount,
    startedAt: cached.startedAt,
    completedAt: cached.completedAt,
    error: cached.error,
  };
});

fastify.get('/api/projects', async () => {
  return Array.from(analysisCache.values()).map((c) => ({
    projectId: c.projectId,
    projectPath: c.projectPath,
    status: c.status,
    nodeCount: c.nodeCount,
    edgeCount: c.edgeCount,
    completedAt: c.completedAt,
  }));
});

fastify.register(async function (fastify) {
  fastify.get('/ws/analysis/:projectId', { websocket: true }, (socket, request) => {
    const { projectId } = request.params as { projectId: string };

    const interval = setInterval(() => {
      const cached = analysisCache.get(projectId);
      if (cached) {
        socket.send(JSON.stringify({
          projectId: cached.projectId,
          status: cached.status,
          nodeCount: cached.nodeCount,
          edgeCount: cached.edgeCount,
          error: cached.error,
        }));
        if (cached.status === 'completed' || cached.status === 'error') {
          clearInterval(interval);
        }
      }
    }, 500);

    socket.on('close', () => {
      clearInterval(interval);
    });
  });
});

const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '127.0.0.1';

export default fastify;

if (process.env.NODE_ENV !== 'test') {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Codebase Agent Orchestrator running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
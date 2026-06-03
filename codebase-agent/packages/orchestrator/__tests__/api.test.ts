import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('Orchestrator API', () => {
  let app: any;

  before(async () => {
    process.env.NODE_ENV = 'test';
    app = (await import('../src/index.js')).default;
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
  });

  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.status, 'ok');
      assert.ok(body.uptime >= 0);
    });
  });

  describe('GET /api/projects', () => {
    it('returns empty list initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/projects/:id/graph (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/graph',
      });
      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/projects/:id/duplications (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/duplications',
      });
      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/projects/:id/debt (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/debt',
      });
      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/projects/:id/docs (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/docs',
      });
      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/projects/:id/refactor-suggestions (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/refactor-suggestions',
      });
      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/status/:id (not found)', () => {
    it('returns 404 for unknown project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/status/nonexistent',
      });
      assert.equal(response.statusCode, 404);
    });
  });
});
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('OpenAPI Swagger Documentation Route', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs/json deve retornar o documento OpenAPI 3.0 completo com as rotas registradas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(res.statusCode).toBe(200);
    const schema = JSON.parse(res.body);

    expect(schema).toHaveProperty('openapi');
    expect(schema.info.title).toBe('Financial Intelligence API');

    const paths = Object.keys(schema.paths);
    expect(paths).toContain('/health');
    expect(paths).toContain('/api/auth/register');
    expect(paths).toContain('/api/auth/login');
    expect(paths).toContain('/api/user/ai-key');
    expect(paths).toContain('/api/transactions/upload');
    expect(paths).toContain('/api/transactions');
    expect(paths).toContain('/api/transactions/categorize');
    expect(paths).not.toContain('/api/integrations/pluggy/sync');
    expect(paths).toContain('/api/chat/stream');
    expect(paths).toContain('/api/analysis/{month}');
  });
});

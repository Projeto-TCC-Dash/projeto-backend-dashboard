import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('Pluggy Public Routes Dismantling (HTTP Inject)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve retornar 404 para a rota antiga POST /api/integrations/pluggy/sync', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/pluggy/sync',
      payload: {
        itemId: '87c6b485-6bbd-4e96-a81d-872f9b2d8801',
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

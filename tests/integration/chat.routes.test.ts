import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('Chat SSE Routes (HTTP Inject & BYOK Guard)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve retornar 401 se a requisição não contiver token JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        message: 'Como economizar este mês?',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

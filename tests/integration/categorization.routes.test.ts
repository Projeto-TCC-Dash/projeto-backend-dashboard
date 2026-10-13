import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('Categorization Routes (HTTP Inject & BYOK Guard)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve retornar 401 se não autenticado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/categorize',
    });

    expect(res.statusCode).toBe(401);
  });
});

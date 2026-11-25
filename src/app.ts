import type { IncomingMessage, ServerResponse } from 'node:http';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastify, { FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { connectDatabase } from './config/database.js';
import { env, isCorsOriginAllowed } from './config/env.js';
import { setupErrorHandler } from './plugins/error-handler.plugin.js';
import { accountsRoutes } from './routes/accounts.routes.js';
import { analysisRoutes } from './routes/analysis.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { transactionRoutes } from './routes/transactions.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { fiscalRoutes } from './routes/fiscal.routes.js';
import { budgetRoutes } from './routes/budget.routes.js';
import { investmentRoutes } from './routes/investment.routes.js';
import { userRoutes } from './routes/user.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global Error Handler
  setupErrorHandler(app);

  // CORS
  app.register(fastifyCors, {
    origin: (origin, cb) => {
      cb(null, isCorsOriginAllowed(origin));
    },
  });

  // Rate Limiting
  app.register(fastifyRateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
  });

  // Multipart upload
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // JWT Stateless Auth
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // Swagger OpenAPI Documentation
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Financial Intelligence API',
        description: 'API REST do backend financeiro com arquitetura BYOK, ingestão de extratos OFX/CSV, módulo fiscal e consultoria patrimonial via IA.',
        version: '1.3.0',
      },
      tags: [
        { name: 'Auth', description: 'Autenticação e gerenciamento de chaves de API BYOK' },
        { name: 'Users', description: 'Perfil de usuário e preferências financeiras' },
        { name: 'Accounts', description: 'Gestão de contas correntes, cartões e investimentos' },
        { name: 'Transactions', description: 'Lançamentos, categorização e extratos financeiros' },
        { name: 'Fiscal', description: 'Gestão fiscal, dedutibilidade IRPF, OCR de recibos e Dossiê Fiscal' },
        { name: 'Budgets', description: 'Planejamento e acompanhamento de orçamentos mensais' },
        { name: 'Investments', description: 'Alocação patrimonial da carteira por macroclasses e risco' },
        { name: 'Analysis', description: 'Inteligência financeira agregada e análise multi-mês' },
        { name: 'Chat', description: 'Consultor financeiro inteligente conversacional' },
        { name: 'Health', description: 'Verificação de integridade operacional do sistema' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  // Healthcheck route
  app.register(healthRoutes);

  // Auth & User routes
  app.register(authRoutes);
  app.register(userRoutes);

  // Accounts CRUD routes
  app.register(accountsRoutes);

  // Transactions & Export routes
  app.register(transactionRoutes);
  app.register(exportRoutes);
  app.register(fiscalRoutes);
  app.register(budgetRoutes);
  app.register(investmentRoutes);

  // Chatbot SSE routes
  app.register(chatRoutes);

  // Financial Analysis routes (Cache & TTL)
  app.register(analysisRoutes);

  return app;
}

let vercelApp: FastifyInstance | null = null;
let vercelReadyPromise: Promise<void> | null = null;

async function ensureVercelApp(): Promise<FastifyInstance> {
  if (!vercelApp) {
    vercelApp = buildApp();
  }
  if (!vercelReadyPromise) {
    vercelReadyPromise = Promise.resolve(vercelApp.ready())
      .then(() => undefined)
      .catch((error) => {
        vercelReadyPromise = null;
        throw error;
      });
  }
  await vercelReadyPromise;
  return vercelApp;
}

/**
 * Export padrão compatível com a detecção automática de Fastify/Serverless da Vercel (`src/app.ts`).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await connectDatabase();
    const app = await ensureVercelApp();
    app.server.emit('request', req, res);
  } catch (error) {
    console.error('❌ Erro na execução serverless (Vercel):', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Falha ao inicializar a aplicação.',
        })
      );
    }
  }
}

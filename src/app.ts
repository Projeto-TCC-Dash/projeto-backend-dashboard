import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastify, { FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { setupErrorHandler } from './plugins/error-handler.plugin.js';
import { authRoutes } from './routes/auth.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { pluggyRoutes } from './routes/pluggy.routes.js';
import { transactionRoutes } from './routes/transactions.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: env.NODE_ENV !== 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global Error Handler
  setupErrorHandler(app);

  // CORS
  app.register(fastifyCors, {
    origin: true,
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
        description: 'API REST do backend financeiro com arquitetura BYOK, ingestão de extratos OFX/CSV, Open Finance e consultoria via IA.',
        version: '1.0.0',
      },
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

  // Transactions routes
  app.register(transactionRoutes);

  // Pluggy Open Finance routes
  app.register(pluggyRoutes);

  // Chatbot SSE routes
  app.register(chatRoutes);

  return app;
}

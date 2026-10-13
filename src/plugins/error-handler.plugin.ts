import { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export function setupErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | any, request, reply) => {
    // 1. Erros de validação Zod
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Falha na validação dos dados de entrada.',
        issues: error.issues,
      });
    }

    // 2. Erros de chave duplicada no MongoDB (E11000)
    if (error.code === 11000) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'Registro duplicado: já existe um documento com esses identificadores únicos.',
      });
    }

    // 3. Erros HTTP já com statusCode definido
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Client Error',
        message: error.message,
      });
    }

    // 4. Erros internos do servidor
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Ocorreu um erro interno inesperado no servidor.',
    });
  });
}

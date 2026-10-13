import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/user.model.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de autenticação ausente ou inválido.',
    });
  }
}

export async function requireAiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Garante que o usuário está autenticado antes de checar a chave
  await requireAuth(request, reply);
  if (reply.sent) {
    return;
  }

  const userId = request.user.id;
  const user = await UserModel.findById(userId).exec();

  if (!user || !user.hasAiKey()) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Acesso bloqueado: Cadastre e valide sua API Key do Google AI Studio (BYOK) em PUT /api/user/ai-key para utilizar recursos analíticos de IA.',
    });
  }
}

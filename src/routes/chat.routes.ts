import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAiKey, requireAuth } from '../plugins/auth.plugin.js';
import { ChatMessageRequestSchema } from '../schemas/chat.schemas.js';
import { AuthService } from '../services/auth.service.js';
import { ChatService } from '../services/chat.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { GeminiErrorParser } from '../utils/gemini-errors.js';

export const chatRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/api/chat/stream',
    {
      preHandler: [requireAuth, requireAiKey],
      schema: {
        description: 'Consultoria financeira em tempo real via Server-Sent Events (SSE)',
        tags: ['Chatbot'],
        security: [{ bearerAuth: [] }],
        body: ChatMessageRequestSchema,
        response: {
          403: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { message, sessionId } = request.body;
      const userId = request.user.id;

      // 1. Obter ou criar sessão de chat
      const session = await ChatService.getOrCreateSession(userId, sessionId);

      // 2. Descriptografar efemeramente a chave BYOK do usuário
      const apiKey = await AuthService.getDecryptedApiKey(userId);

      // 3. Montar instruções de sistema com o resumo financeiro mensal injetado
      const systemInstruction = await ChatService.buildSystemInstruction(userId);

      // 4. Configurar headers para Server-Sent Events (SSE)
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let isClientConnected = true;
      request.raw.on('close', () => {
        isClientConnected = false;
      });

      let fullResponseText = '';

      try {
        const stream = GeminiService.streamFinancialAdvisor(
          apiKey,
          systemInstruction,
          session.messages.map((m) => ({ role: m.role, content: m.content })),
          message
        );

        for await (const chunk of stream) {
          if (!isClientConnected) {
            break;
          }
          fullResponseText += chunk;
          reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        if (isClientConnected) {
          reply.raw.write(
            `data: ${JSON.stringify({
              done: true,
              sessionId: session._id.toString(),
            })}\n\n`
          );
        }

        // 5. Salvar histórico da conversa no MongoDB
        if (fullResponseText) {
          await ChatService.appendMessages(
            session._id.toString(),
            message,
            fullResponseText
          );
        }
      } catch (err: any) {
        console.error('❌ Erro no streaming SSE do chat:', err?.message || err);
        const parsed = GeminiErrorParser.parse(err);
        if (isClientConnected) {
          reply.raw.write(
            `data: ${JSON.stringify({
              error: parsed.userMessage,
              code: parsed.type,
              statusCode: parsed.statusCode,
            })}\n\n`
          );
        }
      } finally {
        reply.raw.end();
      }
    }
  );
};

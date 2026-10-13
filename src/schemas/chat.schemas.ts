import { z } from 'zod';

export const ChatMessageRequestSchema = z.object({
  message: z.string().min(1, 'A mensagem não pode ser vazia.').trim(),
  sessionId: z.string().optional(),
});
export type ChatMessageRequest = z.infer<typeof ChatMessageRequestSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;

import mongoose from 'mongoose';
import { SYSTEM_DEFAULTS } from '../config/constants.js';
import { ChatSessionModel, IChatSession } from '../models/chat-session.model.js';
import { TransactionService } from './transaction.service.js';

export class ChatService {
  /**
   * Obtém a sessão de chat especificada ou a mais recente do usuário, criando uma nova caso não exista.
   */
  public static async getOrCreateSession(
    userId: string,
    sessionId?: string
  ): Promise<IChatSession> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      const session = await ChatSessionModel.findOne({
        _id: new mongoose.Types.ObjectId(sessionId),
        userId: userObjectId,
      }).exec();
      if (session) {
        return session;
      }
    }

    // Busca a sessão mais recente
    const latest = await ChatSessionModel.findOne({ userId: userObjectId })
      .sort({ updatedAt: -1 })
      .exec();

    if (latest) {
      return latest;
    }

    // Cria nova sessão se nenhuma for encontrada
    return ChatSessionModel.create({
      userId: userObjectId,
      messages: [],
    });
  }

  /**
   * Constrói as instruções de sistema da persona de consultor financeiro injetando o resumo mensal do usuário.
   */
  public static async buildSystemInstruction(userId: string): Promise<string> {
    const summary = await TransactionService.getMonthlyFinancialSummary(userId);

    const categoriesFormatted = Object.entries(summary.categoryTotals)
      .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
      .join('\n');

    return `Você é o Consultor Financeiro Inteligente da plataforma.
Sua missão é auxiliar o usuário a compreender seus hábitos de consumo, identificar desperdícios e atingir estabilidade e crescimento patrimonial.

DIRETRIZES DA PERSONA:
1. Tom de voz: Empático, pragmático, analítico e motivador.
2. Seja direto e objetivo, apresentando cálculos e comparações percentuais quando relevante.
3. Não faça recomendações especulativas de alto risco (como apostas ou day trade); foque em controle orçamentário, reserva de emergência e hábitos conscientes.
4. Baseie suas análises EXCLUSIVAMENTE nos dados consolidados do mês do usuário informados abaixo.

CONTEXTO FINANCEIRO DO MÊS (${summary.month}):
- Total de Entradas/Receitas: R$ ${summary.totalIncome.toFixed(2)}
- Total de Saídas/Despesas: R$ ${summary.totalExpenses.toFixed(2)}
- Saldo Líquido do Mês: R$ ${summary.netBalance.toFixed(2)}
- Gastos por Categoria:
${categoriesFormatted || '  (Nenhum gasto registrado ainda)'}

Responda sempre em português do Brasil de forma clara e amigável.`;
  }

  /**
   * Persiste uma nova mensagem de usuário e resposta de assistente na sessão de chat.
   */
  public static async appendMessages(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    await ChatSessionModel.findByIdAndUpdate(
      sessionId,
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: userMessage, timestamp: new Date() },
              { role: 'assistant', content: assistantResponse, timestamp: new Date() },
            ],
            $slice: -SYSTEM_DEFAULTS.MAX_CHAT_HISTORY_MESSAGES, // Mantém apenas as últimas N mensagens
          },
        },
      },
      { new: true }
    ).exec();
  }
}

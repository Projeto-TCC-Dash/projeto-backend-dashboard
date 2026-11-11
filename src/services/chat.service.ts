import mongoose from 'mongoose';
import { SYSTEM_DEFAULTS } from '../config/constants.js';
import { ChatSessionModel, IChatSession } from '../models/chat-session.model.js';
import { UserModel } from '../models/user.model.js';
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
   * Constrói as instruções de sistema da persona de consultor financeiro injetando o resumo mensal e o perfil financeiro do usuário.
   */
  public static async buildSystemInstruction(userId: string): Promise<string> {
    const summary = await TransactionService.getMonthlyFinancialSummary(userId);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await UserModel.findById(userObjectId).exec();
    const profile = user?.financialProfile;

    const categoriesFormatted = Object.entries(summary.categoryTotals)
      .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
      .join('\n');

    const hasProfileData =
      profile &&
      (profile.incomeType ||
        profile.declaredMonthlyIncome !== undefined ||
        (profile.goals && profile.goals.length > 0) ||
        profile.riskProfile);

    const profileBlock = hasProfileData
      ? `PERFIL FINANCEIRO DO USUÁRIO:
- Regime de Renda: ${profile.incomeType || 'Não informado'}
- Renda Mensal Declarada: ${profile.declaredMonthlyIncome !== undefined ? `R$ ${profile.declaredMonthlyIncome.toFixed(2)}` : 'Não informada'}
- Metas Prioritárias: ${profile.goals && profile.goals.length > 0 ? profile.goals.join(', ') : 'Não informadas'}
- Perfil de Risco: ${profile.riskProfile || 'Não informado'}`
      : 'PERFIL FINANCEIRO DO USUÁRIO: Não informado (adote parâmetros padrão de planejamento financeiro).';

    return `Você é o Consultor Financeiro Inteligente da plataforma.
Sua missão é auxiliar o usuário a compreender seus hábitos de consumo, identificar desperdícios e atingir estabilidade e crescimento patrimonial.

DIRETRIZES DA PERSONA:
1. Tom de voz: Empático, pragmático, analítico e motivador.
2. Seja direto e objetivo, apresentando cálculos e comparações percentuais quando relevante.
3. Não faça recomendações especulativas de alto risco (como apostas ou day trade); foque em controle orçamentário, reserva de emergência e hábitos conscientes.
4. Baseie suas análises EXCLUSIVAMENTE nos dados consolidados do mês do usuário informados abaixo.
5. Importante: Diferencie despesas operacionais primárias (consumo real) de quitações de fatura de cartão ('Pagamento de Fatura'), para não acusar o usuário de ter despesas duplicadas.
6. Personalize seu aconselhamento e priorização de acordo com o regime de trabalho, renda declarada e metas do usuário informados no perfil (ex: se PJ/autônomo, reforce a necessidade de reserva de emergência de 6 a 12 meses; se CLT/servidor público, 3 a 6 meses; priorize as metas declaradas pelo usuário).

${profileBlock}

CONTEXTO FINANCEIRO DO MÊS (${summary.month}):
- Total de Entradas/Receitas: R$ ${summary.totalIncome.toFixed(2)}
- Despesas Operacionais (Consumo): R$ ${summary.totalExpenses.toFixed(2)}
- Quitação de Faturas de Cartão: R$ ${summary.invoiceSettlements.toFixed(2)}
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

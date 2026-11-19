import mongoose from 'mongoose';
import { BudgetConsumptionStatus, Category } from '../config/constants.js';
import { BudgetPlanModel } from '../models/budget.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import {
  BudgetConsumptionItem,
  BudgetOverviewResponse,
  SetBudgetBody,
} from '../schemas/budget.schemas.js';

export class BudgetNotFoundError extends Error {
  public statusCode = 404;

  constructor(message = 'Nenhum orçamento configurado para o mês informado.') {
    super(message);
    this.name = 'BudgetNotFoundError';
  }
}

export class BudgetService {
  /**
   * Determina o status orçamentário baseado na porcentagem consumida.
   * - REGULAR: < 70%
   * - WARNING: 70% a 99.9%
   * - EXCEEDED: >= 100%
   */
  public static calculateStatus(percent: number): BudgetConsumptionStatus {
    if (percent >= 100) {
      return 'EXCEEDED';
    }
    if (percent >= 70) {
      return 'WARNING';
    }
    return 'REGULAR';
  }

  /**
   * Cria ou substitui o plano de orçamento do usuário para o mês informado e retorna o overview atualizado.
   */
  public static async upsertBudgetPlan(
    userId: string,
    month: string,
    data: SetBudgetBody
  ): Promise<BudgetOverviewResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await BudgetPlanModel.findOneAndUpdate(
      { userId: userObjectId, month },
      {
        $set: {
          totalLimitAmount: Math.round(data.totalLimitAmount * 100) / 100,
          categoryBudgets: data.categoryBudgets.map((cb) => ({
            category: cb.category,
            limitAmount: Math.round(cb.limitAmount * 100) / 100,
          })),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return this.getBudgetOverview(userId, month);
  }

  /**
   * Obtém a visão consolidada de consumo de orçamento para o mês informado.
   */
  public static async getBudgetOverview(
    userId: string,
    month: string
  ): Promise<BudgetOverviewResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const budget = await BudgetPlanModel.findOne({
      userId: userObjectId,
      month,
    }).exec();

    if (!budget) {
      throw new BudgetNotFoundError();
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const m = parseInt(monthStr || '1', 10) - 1;

    const startDate = new Date(Date.UTC(year, m, 1));
    const endDate = new Date(Date.UTC(year, m + 1, 1));

    // Carregar todas as despesas operacionais do mês (excluindo pagamentos de fatura e receitas)
    const transactions = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
      amount: { $lt: 0 },
      category: { $ne: 'Pagamento de Fatura' },
    }).exec();

    const categorySpentMap: Record<string, number> = {};
    let totalSpentAmount = 0;

    for (const t of transactions) {
      if (t.amount >= 0 || t.category === 'Pagamento de Fatura') {
        continue;
      }
      const absVal = Math.abs(t.amount);
      const cat = t.category || 'Outros';
      categorySpentMap[cat] = (categorySpentMap[cat] || 0) + absVal;
      totalSpentAmount += absVal;
    }

    totalSpentAmount = Math.round(totalSpentAmount * 100) / 100;
    const totalRemainingAmount =
      Math.round((budget.totalLimitAmount - totalSpentAmount) * 100) / 100;
    const globalPercentConsumed =
      budget.totalLimitAmount > 0
        ? Math.round((totalSpentAmount / budget.totalLimitAmount) * 1000) / 10
        : 0;
    const globalStatus = this.calculateStatus(globalPercentConsumed);

    const categories: BudgetConsumptionItem[] = budget.categoryBudgets.map((cb) => {
      const spent = Math.round((categorySpentMap[cb.category] || 0) * 100) / 100;
      const remaining = Math.round((cb.limitAmount - spent) * 100) / 100;
      const percent =
        cb.limitAmount > 0 ? Math.round((spent / cb.limitAmount) * 1000) / 10 : 0;

      return {
        category: cb.category as Category,
        limitAmount: cb.limitAmount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentConsumed: percent,
        status: this.calculateStatus(percent),
      };
    });

    return {
      month,
      totalLimitAmount: budget.totalLimitAmount,
      totalSpentAmount,
      totalRemainingAmount,
      globalPercentConsumed,
      globalStatus,
      categories,
    };
  }

  /**
   * Retorna resumo de alertas orçamentários para injeção no prompt do consultor inteligente.
   */
  public static async getAlertingBudgetsSummary(
    userId: string,
    month: string
  ): Promise<string | null> {
    try {
      const overview = await this.getBudgetOverview(userId, month);
      const alerting = overview.categories.filter(
        (c) => c.status === 'WARNING' || c.status === 'EXCEEDED'
      );

      if (alerting.length === 0 && overview.globalStatus === 'REGULAR') {
        return null;
      }

      const lines: string[] = ['ALERTAS ORÇAMENTÁRIOS DO MÊS:'];
      if (overview.globalStatus !== 'REGULAR') {
        lines.push(
          `- Teto Global: R$ ${overview.totalSpentAmount.toFixed(2)} de R$ ${overview.totalLimitAmount.toFixed(2)} (${overview.globalPercentConsumed.toFixed(1)}% consumido - Status: ${overview.globalStatus})`
        );
      }

      for (const item of alerting) {
        lines.push(
          `- ${item.category}: R$ ${item.spentAmount.toFixed(2)} de R$ ${item.limitAmount.toFixed(2)} (${item.percentConsumed.toFixed(1)}% - Status: ${item.status})`
        );
      }

      return lines.join('\n');
    } catch {
      return null;
    }
  }
}

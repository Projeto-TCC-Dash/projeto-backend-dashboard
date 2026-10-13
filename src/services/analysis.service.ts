import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { FinancialAnalysisModel, IFinancialMetrics } from '../models/analysis.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { FinancialAnalysisResponse } from '../schemas/analysis.schemas.js';
import { AuthService } from './auth.service.js';
import { GeminiService } from './gemini.service.js';

export class AnalysisService {
  /**
   * Calcula o hash SHA-256 determinístico do estado financeiro de um conjunto de transações.
   * Formato: sha256("${count}_${totalIncome}_${totalExpenses}_${lastTimestamp}_${categoriesSummary}")
   */
  public static calculateStateHash(
    transactions: Array<{ amount: number; date: Date; category?: string }>
  ): string {
    if (transactions.length === 0) {
      return crypto.createHash('sha256').update('empty_0_0_0_none').digest('hex');
    }

    const count = transactions.length;
    let totalIncome = 0;
    let totalExpenses = 0;
    let lastTimestamp = 0;
    const catMap: Record<string, number> = {};

    for (const t of transactions) {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpenses += Math.abs(t.amount);
      }

      const tTime = new Date(t.date).getTime();
      if (tTime > lastTimestamp) {
        lastTimestamp = tTime;
      }

      const cat = t.category || 'Outros';
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
    }

    // Ordenação alfabética para garantir determinismo estrito
    const categoriesSummary = Object.keys(catMap)
      .sort()
      .map((cat) => `${cat}:${Math.round((catMap[cat] ?? 0) * 100) / 100}`)
      .join(';');

    const rawState = `${count}_${Math.round(totalIncome * 100) / 100}_${Math.round(totalExpenses * 100) / 100}_${lastTimestamp}_${categoriesSummary}`;

    return crypto.createHash('sha256').update(rawState).digest('hex');
  }

  /**
   * Calcula as métricas financeiras detalhadas para as transações informadas.
   */
  public static calculateMetrics(
    transactions: Array<{ amount: number; category?: string }>
  ): IFinancialMetrics {
    let totalIncome = 0;
    let totalExpenses = 0;
    const catExpenses: Record<string, number> = {};

    for (const t of transactions) {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        const absVal = Math.abs(t.amount);
        totalExpenses += absVal;
        const cat = t.category || 'Outros';
        catExpenses[cat] = (catExpenses[cat] || 0) + absVal;
      }
    }

    const roundedIncome = Math.round(totalIncome * 100) / 100;
    const roundedExpenses = Math.round(totalExpenses * 100) / 100;
    const netBalance = Math.round((roundedIncome - roundedExpenses) * 100) / 100;

    let savingsRate = 0;
    if (roundedIncome > 0) {
      savingsRate = Math.max(0, Math.round(((roundedIncome - roundedExpenses) / roundedIncome) * 1000) / 10);
    }

    const topCategories = Object.entries(catExpenses)
      .map(([category, amount]) => {
        const roundedAmount = Math.round(amount * 100) / 100;
        const percentage = roundedExpenses > 0 ? Math.round((roundedAmount / roundedExpenses) * 1000) / 10 : 0;
        return { category, amount: roundedAmount, percentage };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalIncome: roundedIncome,
      totalExpenses: roundedExpenses,
      netBalance,
      savingsRate,
      topCategories,
    };
  }

  /**
   * Obtém a análise financeira mensal com validação de cache, TTL e hash de transações.
   */
  public static async getAnalysis(
    userId: string,
    month: string,
    forceRefresh: boolean = false
  ): Promise<FinancialAnalysisResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Delimitar intervalo do mês em UTC
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const m = parseInt(monthStr || '1', 10) - 1;

    const startDate = new Date(Date.UTC(year, m, 1));
    const endDate = new Date(Date.UTC(year, m + 1, 1));

    // 2. Buscar transações do usuário no mês
    const transactions = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
    })
      .sort({ date: -1 })
      .exec();

    if (transactions.length === 0) {
      const error: any = new Error(`Nenhuma transação encontrada para o mês ${month}.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Computar hash de estado atual e métricas
    const currentStateHash = this.calculateStateHash(transactions);
    const metrics = this.calculateMetrics(transactions);

    // 4. Se não for forceRefresh, verificar cache existente no MongoDB
    if (!forceRefresh) {
      const cached = await FinancialAnalysisModel.findOne({
        userId: userObjectId,
        month,
      }).exec();

      if (
        cached &&
        cached.transactionStateHash === currentStateHash &&
        cached.expiresAt.getTime() > Date.now()
      ) {
        return {
          cached: true,
          month: cached.month,
          diagnosis: cached.diagnosis,
          recommendations: cached.recommendations,
          metrics: cached.metrics,
          generatedAt: cached.generatedAt,
          expiresAt: cached.expiresAt,
        };
      }
    }

    // 5. Cache miss ou invalidação: obter chave BYOK do usuário e gerar com Gemini
    const apiKey = await AuthService.getDecryptedApiKey(userId);

    const aiResult = await GeminiService.generateFinancialDiagnosis(apiKey, {
      month,
      totalIncome: metrics.totalIncome,
      totalExpenses: metrics.totalExpenses,
      netBalance: metrics.netBalance,
      savingsRate: metrics.savingsRate,
      topCategories: metrics.topCategories,
    });

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000); // 24h TTL

    // 6. Atualizar ou criar registro no MongoDB (upsert)
    const saved = await FinancialAnalysisModel.findOneAndUpdate(
      { userId: userObjectId, month },
      {
        $set: {
          transactionStateHash: currentStateHash,
          diagnosis: aiResult.diagnosis,
          recommendations: aiResult.recommendations,
          metrics,
          generatedAt,
          expiresAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return {
      cached: false,
      month: saved.month,
      diagnosis: saved.diagnosis,
      recommendations: saved.recommendations,
      metrics: saved.metrics,
      generatedAt: saved.generatedAt,
      expiresAt: saved.expiresAt,
    };
  }
}

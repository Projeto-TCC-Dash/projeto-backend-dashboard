import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { FinancialAnalysisModel, IFinancialMetrics } from '../models/analysis.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { UserModel } from '../models/user.model.js';
import {
  FinancialAnalysisResponse,
  MonthlyDataPoint,
  MultiMonthAnalysisResponse,
} from '../schemas/analysis.schemas.js';
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
    let invoiceSettlements = 0;
    const catExpenses: Record<string, number> = {};

    for (const t of transactions) {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        const absVal = Math.abs(t.amount);
        const cat = t.category || 'Outros';

        if (cat === 'Pagamento de Fatura') {
          invoiceSettlements += absVal;
        } else {
          totalExpenses += absVal;
          catExpenses[cat] = (catExpenses[cat] || 0) + absVal;
        }
      }
    }

    const roundedIncome = Math.round(totalIncome * 100) / 100;
    const roundedExpenses = Math.round(totalExpenses * 100) / 100;
    const roundedInvoices = Math.round(invoiceSettlements * 100) / 100;
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
      invoiceSettlements: roundedInvoices,
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
          recommendations: [...cached.recommendations],
          metrics: {
            totalIncome: cached.metrics.totalIncome,
            totalExpenses: cached.metrics.totalExpenses,
            invoiceSettlements: cached.metrics.invoiceSettlements ?? 0,
            netBalance: cached.metrics.netBalance,
            savingsRate: cached.metrics.savingsRate,
            topCategories: cached.metrics.topCategories.map((c) => ({
              category: c.category,
              amount: c.amount,
              percentage: c.percentage,
            })),
          },
          generatedAt: cached.generatedAt,
          expiresAt: cached.expiresAt,
        };
      }
    }

    // 5. Cache miss ou invalidação: obter chave BYOK do usuário e gerar com Gemini
    const apiKey = await AuthService.getDecryptedApiKey(userId);
    const user = await UserModel.findById(userObjectId).exec();

    const aiResult = await GeminiService.generateFinancialDiagnosis(
      apiKey,
      {
        month,
        totalIncome: metrics.totalIncome,
        totalExpenses: metrics.totalExpenses,
        invoiceSettlements: metrics.invoiceSettlements,
        netBalance: metrics.netBalance,
        savingsRate: metrics.savingsRate,
        topCategories: metrics.topCategories,
      },
      user?.financialProfile
    );

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
      recommendations: [...saved.recommendations],
      metrics,
      generatedAt: saved.generatedAt,
      expiresAt: saved.expiresAt,
    };
  }

  /**
   * Invalida todas as análises em cache do usuário autenticado no MongoDB.
   * Retorna a quantidade de registros de análise removidos.
   */
  public static async invalidate(userId: string): Promise<number> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const result = await FinancialAnalysisModel.deleteMany({
      userId: userObjectId,
    }).exec();
    return result.deletedCount;
  }

  /**
   * Calcula a análise agregada multi-mês em janelas históricas de 3, 6 ou 12 meses.
   */
  public static async getMultiMonthSummary(
    userId: string,
    rangeStr: '3' | '6' | '12' = '6'
  ): Promise<MultiMonthAnalysisResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const rangeMonths = parseInt(rangeStr, 10);

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    // Montar os meses do intervalo (em ordem cronológica)
    const monthsList: string[] = [];
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      monthsList.push(`${y}-${m}`);
    }

    const firstMonthStr = monthsList[0] || `${currentYear}-01`;
    const [firstY, firstM] = firstMonthStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(firstY || '2026', 10), parseInt(firstM || '1', 10) - 1, 1));

    const lastMonthStr = monthsList[monthsList.length - 1] || `${currentYear}-12`;
    const [lastY, lastM] = lastMonthStr.split('-');
    const endDate = new Date(Date.UTC(parseInt(lastY || '2026', 10), parseInt(lastM || '12', 10), 1));

    // Buscar todas as transações do intervalo
    const transactions = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
    }).exec();

    // Agrupar transações por mês (YYYY-MM)
    const monthTxMap: Record<string, Array<{ amount: number; category?: string }>> = {};
    for (const m of monthsList) {
      monthTxMap[m] = [];
    }

    for (const t of transactions) {
      const tDate = new Date(t.date);
      const mKey = `${tDate.getUTCFullYear()}-${String(tDate.getUTCMonth() + 1).padStart(2, '0')}`;
      if (monthTxMap[mKey]) {
        monthTxMap[mKey].push(t);
      }
    }

    // Calcular métricas para cada mês
    const monthlyHistory: MonthlyDataPoint[] = [];
    let totalSavingsSum = 0;
    let totalExpensesSum = 0;
    let totalIncomeSum = 0;

    // Rastrear despesas fixas (Moradia, Saúde, Educação)
    const fixedCategories = ['Moradia', 'Saúde', 'Educação'];
    const fixedExpensesByMonth: Record<string, Record<string, number>> = {};

    for (const mKey of monthsList) {
      const txs = monthTxMap[mKey] || [];
      const metrics = this.calculateMetrics(txs);

      monthlyHistory.push({
        month: mKey,
        totalIncome: metrics.totalIncome,
        totalExpenses: metrics.totalExpenses,
        netBalance: metrics.netBalance,
        savingsRate: metrics.savingsRate,
      });

      totalSavingsSum += metrics.savingsRate;
      totalExpensesSum += metrics.totalExpenses;
      totalIncomeSum += metrics.totalIncome;

      fixedExpensesByMonth[mKey] = {};
      for (const cat of fixedCategories) {
        fixedExpensesByMonth[mKey][cat] = 0;
      }
      for (const t of txs) {
        if (t.amount < 0 && t.category && fixedCategories.includes(t.category)) {
          fixedExpensesByMonth[mKey][t.category] =
            (fixedExpensesByMonth[mKey][t.category] || 0) + Math.abs(t.amount);
        }
      }
    }

    const averageSavingsRate =
      rangeMonths > 0 ? Math.round((totalSavingsSum / rangeMonths) * 10) / 10 : 0;
    const averageMonthlyExpenses =
      rangeMonths > 0 ? Math.round((totalExpensesSum / rangeMonths) * 100) / 100 : 0;
    const averageMonthlyIncome =
      rangeMonths > 0 ? Math.round((totalIncomeSum / rangeMonths) * 100) / 100 : 0;

    // Analisar tendência de custo fixo (comparar primeiro mês com último mês com despesa)
    const firstMonthFixed = fixedExpensesByMonth[firstMonthStr] || {};
    const lastMonthFixed = fixedExpensesByMonth[lastMonthStr] || {};

    let maxChangePct = 0;
    let maxChangeCat: string | undefined;

    for (const cat of fixedCategories) {
      const startVal = firstMonthFixed[cat] || 0;
      const endVal = lastMonthFixed[cat] || 0;
      if (startVal > 0) {
        const pctChange = ((endVal - startVal) / startVal) * 100;
        if (pctChange > maxChangePct) {
          maxChangePct = pctChange;
          maxChangeCat = cat;
        }
      }
    }

    let trendStatus: 'STABLE' | 'GROWING' | 'DECLINING' = 'STABLE';
    if (maxChangePct >= 15) {
      trendStatus = 'GROWING';
    } else if (maxChangePct <= -15) {
      trendStatus = 'DECLINING';
    }

    return {
      rangeMonths,
      averageSavingsRate,
      averageMonthlyExpenses,
      averageMonthlyIncome,
      fixedCostTrend: {
        status: trendStatus,
        percentageChange: Math.round(maxChangePct * 10) / 10,
        alertCategory: trendStatus === 'GROWING' ? maxChangeCat : undefined,
      },
      monthlyHistory,
    };
  }
}

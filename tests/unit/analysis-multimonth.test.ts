import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';

describe('AnalysisService - Multi-Month Analysis Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve calcular corretamente a média de poupança, média de receitas/despesas e tendência de custo fixo', async () => {
    // Simular transações para 3 meses:
    // Mês 1: Receita 8000, Despesa 6000 (Moradia: 2000), Poupança 25%
    // Mês 2: Receita 8000, Despesa 6200 (Moradia: 2200), Poupança 22.5%
    // Mês 3: Receita 8000, Despesa 6600 (Moradia: 2500), Poupança 17.5% -> Moradia cresceu de 2000 para 2500 (+25% -> GROWING)
    const baseDate = new Date();
    const y = baseDate.getUTCFullYear();
    const m = baseDate.getUTCMonth();

    const d1 = new Date(Date.UTC(y, m - 2, 10));
    const d2 = new Date(Date.UTC(y, m - 1, 10));
    const d3 = new Date(Date.UTC(y, m, 10));

    const mockTxs: any[] = [
      // Mês 1
      { amount: 8000, date: d1, category: 'Receita' },
      { amount: -2000, date: d1, category: 'Moradia' },
      { amount: -4000, date: d1, category: 'Alimentação' },
      // Mês 2
      { amount: 8000, date: d2, category: 'Receita' },
      { amount: -2200, date: d2, category: 'Moradia' },
      { amount: -4000, date: d2, category: 'Alimentação' },
      // Mês 3
      { amount: 8000, date: d3, category: 'Receita' },
      { amount: -2500, date: d3, category: 'Moradia' },
      { amount: -4100, date: d3, category: 'Alimentação' },
    ];

    vi.spyOn(TransactionModel, 'find').mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockTxs),
    } as any);

    const result = await AnalysisService.getMultiMonthSummary(userId, '3');

    expect(result.rangeMonths).toBe(3);
    expect(result.monthlyHistory).toHaveLength(3);
    expect(result.averageMonthlyIncome).toBe(8000);
    // (6000 + 6200 + 6600) / 3 = 6266.67
    expect(result.averageMonthlyExpenses).toBeCloseTo(6266.67, 1);
    // (25 + 22.5 + 17.5) / 3 = 21.67
    expect(result.averageSavingsRate).toBeCloseTo(21.7, 1);

    expect(result.fixedCostTrend.status).toBe('GROWING');
    expect(result.fixedCostTrend.alertCategory).toBe('Moradia');
    expect(result.fixedCostTrend.percentageChange).toBeGreaterThanOrEqual(15);
  });

  it('deve classificar tendência de custo fixo como DECLINING quando houver redução >= 15%', async () => {
    const baseDate = new Date();
    const y = baseDate.getUTCFullYear();
    const m = baseDate.getUTCMonth();

    const d1 = new Date(Date.UTC(y, m - 2, 10));
    const d3 = new Date(Date.UTC(y, m, 10));

    const mockTxs: any[] = [
      { amount: 8000, date: d1, category: 'Receita' },
      { amount: -2000, date: d1, category: 'Moradia' },
      { amount: 8000, date: d3, category: 'Receita' },
      { amount: -1500, date: d3, category: 'Moradia' },
    ];

    vi.spyOn(TransactionModel, 'find').mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockTxs),
    } as any);

    const result = await AnalysisService.getMultiMonthSummary(userId, '3');

    expect(result.fixedCostTrend.status).toBe('DECLINING');
    expect(result.fixedCostTrend.percentageChange).toBe(-25);
  });
});

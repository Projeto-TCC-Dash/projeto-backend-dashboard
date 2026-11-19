import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { FiscalService } from '../../src/services/fiscal.service.js';

describe('FiscalService - PJ & Autônomos Unit Tests (US6)', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar applicable: false quando o usuário for assalariado/CLT', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(userId),
        financialProfile: { incomeType: 'SALARIED' },
      }),
    } as any);

    const summary = await FiscalService.getPjSummary(userId, '2026');

    expect(summary.applicable).toBe(false);
    expect(summary.grossRevenueYearToDate).toBe(0);
    expect(summary.ceilingPercentage).toBe(0);
    expect(summary.proLaboreTotal).toBe(0);
    expect(summary.dividendsTotal).toBe(0);
  });

  it('deve consolidar faturamento bruto, pró-labore e dividendos para usuário PJ/Autônomo', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(userId),
        financialProfile: { incomeType: 'PJ_AUTONOMO' },
      }),
    } as any);

    const revenueMock = [
      { amount: 15000, category: 'Receita' },
      { amount: 20000, category: 'Receita' },
      { amount: 30000, category: 'Receita' },
    ];

    const withdrawalMock = [
      { amount: -5000, cleanDescription: 'PAGAMENTO PRO LABORE REF 10/2026' },
      { amount: -5000, cleanDescription: 'PRO-LABORE SOCIO ADMINISTRADOR' },
      { amount: -12000, cleanDescription: 'DISTRIBUICAO LUCRO TRIMESTRAL' },
      { amount: -8000, cleanDescription: 'PAGAMENTO DIVIDENDOS PJ' },
      { amount: -1500, cleanDescription: 'COMPRA MATERIAL ESCRITORIO' },
    ];

    vi.spyOn(TransactionModel, 'find')
      .mockImplementationOnce(() => ({
        exec: vi.fn().mockResolvedValue(revenueMock),
      } as any))
      .mockImplementationOnce(() => ({
        exec: vi.fn().mockResolvedValue(withdrawalMock),
      } as any));

    const summary = await FiscalService.getPjSummary(userId, '2026');

    expect(summary.applicable).toBe(true);
    expect(summary.grossRevenueYearToDate).toBe(65000);
    expect(summary.annualLimit).toBe(81000);
    // 65000 / 81000 = 80.2469% -> arredondado para 80.2%
    expect(summary.ceilingPercentage).toBe(80.2);
    expect(summary.proLaboreTotal).toBe(10000);
    expect(summary.dividendsTotal).toBe(20000);
  });

  it('deve calcular corretamente 0% quando o usuário PJ não tiver receitas no exercício', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(userId),
        financialProfile: { incomeType: 'ENTREPRENEUR' },
      }),
    } as any);

    vi.spyOn(TransactionModel, 'find')
      .mockImplementationOnce(() => ({
        exec: vi.fn().mockResolvedValue([]),
      } as any))
      .mockImplementationOnce(() => ({
        exec: vi.fn().mockResolvedValue([]),
      } as any));

    const summary = await FiscalService.getPjSummary(userId, '2026');

    expect(summary.applicable).toBe(true);
    expect(summary.grossRevenueYearToDate).toBe(0);
    expect(summary.ceilingPercentage).toBe(0);
    expect(summary.proLaboreTotal).toBe(0);
    expect(summary.dividendsTotal).toBe(0);
  });
});

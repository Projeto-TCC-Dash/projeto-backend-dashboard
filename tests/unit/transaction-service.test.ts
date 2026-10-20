import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { AnalysisService } from '../../src/services/analysis.service.js';
import { TransactionService } from '../../src/services/transaction.service.js';

describe('TransactionService.deleteTransaction - Unit Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const transactionId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve excluir a transação atomicamente via findOneAndDelete e invalidar o cache de análise do usuário', async () => {
    const mockDeletedDoc = {
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
      amount: -150,
      cleanDescription: 'Supermercado Teste',
    };

    const findOneAndDeleteSpy = vi.spyOn(TransactionModel, 'findOneAndDelete').mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockDeletedDoc),
    } as any);

    const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(1);

    const result = await TransactionService.deleteTransaction(userId, transactionId);

    expect(result).toBe(true);
    expect(findOneAndDeleteSpy).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith(userId);
  });

  it('deve retornar false e não chamar invalidação quando a transação não existir ou pertencer a outro usuário', async () => {
    const findOneAndDeleteSpy = vi.spyOn(TransactionModel, 'findOneAndDelete').mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    } as any);

    const invalidateSpy = vi.spyOn(AnalysisService, 'invalidate').mockResolvedValue(0);

    const result = await TransactionService.deleteTransaction(userId, transactionId);

    expect(result).toBe(false);
    expect(findOneAndDeleteSpy).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

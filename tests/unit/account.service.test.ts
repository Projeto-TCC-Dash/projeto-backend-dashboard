import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCOUNT_NAME } from '../../src/config/constants.js';
import { AccountModel } from '../../src/models/account.model.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { AccountService } from '../../src/services/account.service.js';

describe('AccountService Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  it('toResponseItem deve formatar o documento corretamente com saldo e contagem', () => {
    const mockAccount: any = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(userId),
      name: 'Conta Teste',
      type: 'CHECKING',
      initialBalance: 500,
      institution: 'Banco XYZ',
      color: '#123456',
      createdAt: new Date('2026-10-19T10:00:00Z'),
      updatedAt: new Date('2026-10-19T10:00:00Z'),
    };

    const item = AccountService.toResponseItem(mockAccount, 1500, 3);
    expect(item.id).toBe(mockAccount._id.toString());
    expect(item.name).toBe('Conta Teste');
    expect(item.initialBalance).toBe(500);
    expect(item.balance).toBe(1500);
    expect(item.transactionCount).toBe(3);
  });

  it('getOrCreateDefaultAccount deve criar a Conta Principal se nenhuma existir e migrar transações legadas', async () => {
    const mockAccountDoc: any = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(userId),
      name: DEFAULT_ACCOUNT_NAME,
      type: 'CHECKING',
      initialBalance: 0,
      color: '#2563EB',
    };

    const findOneSpy = vi.spyOn(AccountModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(null),
    } as any);

    const createSpy = vi.spyOn(AccountModel, 'create').mockResolvedValue(mockAccountDoc as any);
    const updateManySpy = vi.spyOn(TransactionModel, 'updateMany').mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modifiedCount: 10 }),
    } as any);

    const account = await AccountService.getOrCreateDefaultAccount(userId);
    expect(account.name).toBe(DEFAULT_ACCOUNT_NAME);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DEFAULT_ACCOUNT_NAME,
        type: 'CHECKING',
        initialBalance: 0,
      })
    );
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(mongoose.Types.ObjectId),
      }),
      expect.objectContaining({
        $set: { accountId: mockAccountDoc._id },
      })
    );

    findOneSpy.mockRestore();
    createSpy.mockRestore();
    updateManySpy.mockRestore();
  });
});

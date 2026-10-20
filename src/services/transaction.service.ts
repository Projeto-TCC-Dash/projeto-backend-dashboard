import mongoose from 'mongoose';
import { Category, SYSTEM_DEFAULTS } from '../config/constants.js';
import { AccountModel } from '../models/account.model.js';
import { ITransaction, TransactionModel } from '../models/transaction.model.js';
import {
  ListTransactionsQuery,
  UpdateTransactionBody,
  UploadTransactionsResponse,
} from '../schemas/transaction.schemas.js';
import { AccountNotFoundError, AccountService } from './account.service.js';
import { AnalysisService } from './analysis.service.js';
import { ParsedTransaction } from './parser.service.js';

export class TransactionService {
  /**
   * Atualiza parcialmente uma transação garantindo isolamento multi-tenant estrito por userId.
   * Retorna a transação atualizada ou null caso o documento não pertença ao usuário ou não exista.
   */
  public static async updateTransaction(
    userId: string,
    transactionId: string,
    updateData: UpdateTransactionBody
  ): Promise<ITransaction | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const transactionObjectId = new mongoose.Types.ObjectId(transactionId);

    const updateFields: { category?: Category; cleanDescription?: string; accountId?: mongoose.Types.ObjectId } = {};
    if (updateData.category !== undefined) {
      updateFields.category = updateData.category;
    }
    if (updateData.cleanDescription !== undefined) {
      updateFields.cleanDescription = updateData.cleanDescription;
    }
    if (updateData.accountId !== undefined) {
      const targetAccount = await AccountModel.findOne({
        _id: new mongoose.Types.ObjectId(updateData.accountId),
        userId: userObjectId,
      }).exec();

      if (!targetAccount) {
        return null;
      }
      updateFields.accountId = targetAccount._id;
    }

    return TransactionModel.findOneAndUpdate(
      {
        _id: transactionObjectId,
        userId: userObjectId,
      },
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
      }
    ).exec();
  }

  /**
   * Exclui permanentemente uma transação individual garantindo isolamento multi-tenant por userId.
   * Ao excluir, invalida o cache de análises financeiras do usuário.
   * Retorna true se a transação foi encontrada e excluída, ou false caso não pertença ao usuário ou não exista.
   */
  public static async deleteTransaction(
    userId: string,
    transactionId: string
  ): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const transactionObjectId = new mongoose.Types.ObjectId(transactionId);

    const deleted = await TransactionModel.findOneAndDelete({
      _id: transactionObjectId,
      userId: userObjectId,
    }).exec();

    if (!deleted) {
      return false;
    }

    await AnalysisService.invalidate(userId);
    return true;
  }

  /**
   * Importa um lote de transações de forma estritamente idempotente utilizando bulkWrite.
   * Transações já existentes com a combinação (userId, externalId) são ignoradas.
   */
  public static async importTransactions(
    userId: string,
    transactions: ParsedTransaction[],
    accountId?: string
  ): Promise<UploadTransactionsResponse> {
    if (transactions.length === 0) {
      return { totalExtracted: 0, imported: 0, duplicatesIgnored: 0 };
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    let targetAccountId: mongoose.Types.ObjectId;
    if (accountId) {
      const account = await AccountModel.findOne({
        _id: new mongoose.Types.ObjectId(accountId),
        userId: userObjectId,
      }).exec();

      if (!account) {
        throw new AccountNotFoundError('Conta informada para importação não encontrada.');
      }
      targetAccountId = account._id;
    } else {
      const defaultAccount = await AccountService.getOrCreateDefaultAccount(userId);
      targetAccountId = defaultAccount._id;
    }

    const operations = transactions.map((t) => ({
      updateOne: {
        filter: {
          userId: userObjectId,
          externalId: t.externalId,
        },
        update: {
          $setOnInsert: {
            userId: userObjectId,
            accountId: targetAccountId,
            externalId: t.externalId,
            rawDescription: t.rawDescription,
            cleanDescription: t.cleanDescription,
            amount: t.amount,
            date: t.date,
            category: SYSTEM_DEFAULTS.DEFAULT_CATEGORY,
            source: t.source,
          },
        },
        upsert: true,
      },
    }));

    const result = await TransactionModel.bulkWrite(operations, { ordered: false });

    const imported = result.upsertedCount;
    const totalExtracted = transactions.length;
    const duplicatesIgnored = Math.max(0, totalExtracted - imported);

    return {
      totalExtracted,
      imported,
      duplicatesIgnored,
    };
  }

  /**
   * Lista transações filtradas pelo usuário com isolamento multi-tenant estrito.
   */
  public static async listTransactions(
    userId: string,
    filters: ListTransactionsQuery
  ): Promise<ITransaction[]> {
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };

    if (filters.accountId) {
      query.accountId = new mongoose.Types.ObjectId(filters.accountId);
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.source) {
      query.source = filters.source;
    }

    if (filters.month) {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr || '2026', 10);
      const month = parseInt(monthStr || '1', 10) - 1;

      const startDate = new Date(Date.UTC(year, month, 1));
      const endDate = new Date(Date.UTC(year, month + 1, 1));

      query.date = { $gte: startDate, $lt: endDate };
    }

    return TransactionModel.find(query).sort({ date: -1 }).exec();
  }

  /**
   * Extrai e deduplica em memória os nomes únicos de estabelecimentos comerciais
   * que estão com categoria pendente ('Não Categorizado') para minimização extrema de tokens antes do envio ao Gemini.
   */
  public static async getUniqueUncategorizedMerchants(userId: string): Promise<string[]> {
    const transactions = await TransactionModel.find(
      {
        userId: new mongoose.Types.ObjectId(userId),
        category: SYSTEM_DEFAULTS.DEFAULT_CATEGORY,
      },
      { cleanDescription: 1 }
    ).exec();

    const uniqueSet = new Set<string>();
    for (const t of transactions) {
      if (t.cleanDescription && t.cleanDescription !== 'DESCONHECIDO') {
        uniqueSet.add(t.cleanDescription);
      }
    }

    return Array.from(uniqueSet);
  }

  /**
   * Reassocia localmente as categorias recebidas da IA para todas as transações correspondentes no MongoDB.
   */
  public static async reassociateCategories(
    userId: string,
    categoryMap: Record<string, Category>
  ): Promise<number> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let totalUpdated = 0;

    const entries = Object.entries(categoryMap);
    if (entries.length === 0) {
      return 0;
    }

    const bulkOps = entries.map(([merchant, category]) => ({
      updateMany: {
        filter: {
          userId: userObjectId,
          cleanDescription: merchant,
        },
        update: {
          $set: { category },
        },
      },
    }));

    const result = await TransactionModel.bulkWrite(bulkOps, { ordered: false });
    totalUpdated = result.modifiedCount;

    return totalUpdated;
  }

  /**
   * Agrega o resumo financeiro consolidado do mês do usuário para injeção de contexto no chatbot.
   */
  public static async getMonthlyFinancialSummary(
    userId: string,
    targetDate: Date = new Date()
  ): Promise<{
    month: string;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    categoryTotals: Record<string, number>;
  }> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();

    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 1));

    const transactions = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
    }).exec();

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};

    for (const t of transactions) {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpenses += Math.abs(t.amount);
      }

      const cat = t.category || SYSTEM_DEFAULTS.DEFAULT_CATEGORY;
      categoryTotals[cat] = Math.round(((categoryTotals[cat] || 0) + Math.abs(t.amount)) * 100) / 100;
    }

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    return {
      month: monthStr,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      categoryTotals,
    };
  }
}

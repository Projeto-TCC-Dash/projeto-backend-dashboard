import mongoose from 'mongoose';
import { TaxCategory, TAX_CATEGORIES } from '../config/constants.js';
import { ITransaction, TransactionModel } from '../models/transaction.model.js';
import { UserModel } from '../models/user.model.js';
import {
  FiscalAnnualSummaryResponse,
  UpdateTransactionFiscalBody,
} from '../schemas/fiscal.schemas.js';

export class FiscalService {
  /**
   * Atualiza as informações de dedutibilidade e metadados fiscais de uma transação.
   * Higieniza o CPF/CNPJ do prestador (mantém apenas dígitos) e assegura isolamento multi-tenant por userId.
   */
  public static async updateTransactionFiscal(
    userId: string,
    transactionId: string,
    data: UpdateTransactionFiscalBody
  ): Promise<ITransaction | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const transactionObjectId = new mongoose.Types.ObjectId(transactionId);

    const transaction = await TransactionModel.findOne({
      _id: transactionObjectId,
      userId: userObjectId,
    }).exec();

    if (!transaction) {
      return null;
    }

    // Higieniza o identificador do prestador (apenas dígitos)
    let cleanDoc = data.providerDocument;
    if (cleanDoc) {
      cleanDoc = cleanDoc.replace(/\D/g, '');
    }

    const deductibleAmount =
      data.deductibleAmount !== undefined
        ? data.deductibleAmount
        : Math.abs(transaction.amount);

    transaction.fiscal = {
      isTaxDeductible: data.isTaxDeductible,
      taxCategory: data.taxCategory,
      providerDocument: cleanDoc,
      providerName: data.providerName?.trim(),
      deductibleAmount: Math.round(deductibleAmount * 100) / 100,
      status: data.status || 'PENDING',
      verifiedAt: data.status === 'CONFIRMED' ? new Date() : undefined,
      notes: data.notes?.trim(),
    };

    await transaction.save();
    return transaction;
  }

  /**
   * Consolida o resumo fiscal anual do usuário com base no ano informado (YYYY).
   * Totaliza deduções fiscais homologadas vs. pendentes e cruza métricas de faturamento para PJ/Autônomos.
   */
  public static async getAnnualSummary(
    userId: string,
    year: string
  ): Promise<FiscalAnnualSummaryResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const numYear = parseInt(year, 10);
    const startDate = new Date(Date.UTC(numYear, 0, 1));
    const endDate = new Date(Date.UTC(numYear + 1, 0, 1));

    // 1. Buscar transações marcadas como dedutíveis no ano
    const deductibleTxs = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
      'fiscal.isTaxDeductible': true,
    }).exec();

    let totalDeductible = 0;
    let confirmedDeductible = 0;
    let pendingDeductible = 0;

    const categoryMap: Record<
      TaxCategory,
      { totalAmount: number; confirmedAmount: number; pendingAmount: number; count: number }
    > = {} as any;

    for (const cat of TAX_CATEGORIES) {
      categoryMap[cat] = {
        totalAmount: 0,
        confirmedAmount: 0,
        pendingAmount: 0,
        count: 0,
      };
    }

    for (const t of deductibleTxs) {
      const fiscal = t.fiscal;
      if (!fiscal) continue;

      const amt = fiscal.deductibleAmount ?? Math.abs(t.amount);
      const roundedAmt = Math.round(amt * 100) / 100;
      const cat = fiscal.taxCategory || 'OTHER_DEDUCTIBLE';

      totalDeductible += roundedAmt;
      if (fiscal.status === 'CONFIRMED') {
        confirmedDeductible += roundedAmt;
        categoryMap[cat].confirmedAmount += roundedAmt;
      } else {
        pendingDeductible += roundedAmt;
        categoryMap[cat].pendingAmount += roundedAmt;
      }

      categoryMap[cat].totalAmount += roundedAmt;
      categoryMap[cat].count += 1;
    }

    const byCategory = TAX_CATEGORIES.map((cat) => ({
      taxCategory: cat,
      totalAmount: Math.round(categoryMap[cat].totalAmount * 100) / 100,
      confirmedAmount: Math.round(categoryMap[cat].confirmedAmount * 100) / 100,
      pendingAmount: Math.round(categoryMap[cat].pendingAmount * 100) / 100,
      count: categoryMap[cat].count,
    })).filter((c) => c.count > 0);

    // 2. Apuração PJ / Autônomo
    const user = await UserModel.findById(userObjectId).exec();
    const incomeType = user?.financialProfile?.incomeType;
    const isPj = incomeType === 'PJ_AUTONOMO' || incomeType === 'ENTREPRENEUR';

    let grossRevenue = 0;
    let proLabore = 0;
    let dividends = 0;

    if (isPj) {
      // Buscar receitas do ano
      const revenueTxs = await TransactionModel.find({
        userId: userObjectId,
        date: { $gte: startDate, $lt: endDate },
        amount: { $gt: 0 },
        category: 'Receita',
      }).exec();

      for (const rev of revenueTxs) {
        grossRevenue += rev.amount;
      }

      // Buscar retiradas de pró-labore ou distribuição de lucros
      const withdrawalTxs = await TransactionModel.find({
        userId: userObjectId,
        date: { $gte: startDate, $lt: endDate },
        amount: { $lt: 0 },
      }).exec();

      for (const w of withdrawalTxs) {
        const desc = (w.cleanDescription || '').toUpperCase();
        if (desc.includes('PRO LABORE') || desc.includes('PRO-LABORE')) {
          proLabore += Math.abs(w.amount);
        } else if (desc.includes('DIVIDENDO') || desc.includes('DISTRIBUICAO LUCRO')) {
          dividends += Math.abs(w.amount);
        }
      }
    }

    const annualLimit = 81000.0; // Padrão MEI de referência
    const ceilingPercentage =
      annualLimit > 0
        ? Math.round((grossRevenue / annualLimit) * 1000) / 10
        : 0;

    return {
      year,
      totalDeductibleExpenses: Math.round(totalDeductible * 100) / 100,
      confirmedDeductibleExpenses: Math.round(confirmedDeductible * 100) / 100,
      pendingDocumentationExpenses: Math.round(pendingDeductible * 100) / 100,
      byCategory,
      pjSummary: {
        applicable: isPj,
        grossRevenueYearToDate: Math.round(grossRevenue * 100) / 100,
        annualLimit,
        ceilingPercentage,
        proLaboreTotal: Math.round(proLabore * 100) / 100,
        dividendsTotal: Math.round(dividends * 100) / 100,
      },
    };
  }
}

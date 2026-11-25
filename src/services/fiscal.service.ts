import mongoose from 'mongoose';
import { TaxCategory, TAX_CATEGORIES } from '../config/constants.js';
import { ITransaction, TransactionModel } from '../models/transaction.model.js';
import { UserModel } from '../models/user.model.js';
import {
  FiscalAnnualSummaryResponse,
  UpdateTransactionFiscalBody,
} from '../schemas/fiscal.schemas.js';
import { IFiscalDossierRecord } from './fiscal-dossier-export.service.js';

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
      const rawCat = fiscal.taxCategory;
      const cat: TaxCategory = rawCat && rawCat in categoryMap ? rawCat : 'OTHER_DEDUCTIBLE';

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
    const pjSummary = await this.getPjSummary(userId, year);

    return {
      year,
      totalDeductibleExpenses: Math.round(totalDeductible * 100) / 100,
      confirmedDeductibleExpenses: Math.round(confirmedDeductible * 100) / 100,
      pendingDocumentationExpenses: Math.round(pendingDeductible * 100) / 100,
      byCategory,
      pjSummary,
    };
  }

  /**
   * Consolida métricas de faturamento bruto PJ/Autônomo acumulado, proximidade de limites de enquadramento
   * e segregação contábil de pró-labore e dividendos.
   */
  public static async getPjSummary(
    userId: string,
    year: string
  ): Promise<{
    applicable: boolean;
    grossRevenueYearToDate: number;
    annualLimit: number;
    ceilingPercentage: number;
    proLaboreTotal: number;
    dividendsTotal: number;
  }> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const numYear = parseInt(year, 10);
    const startDate = new Date(Date.UTC(numYear, 0, 1));
    const endDate = new Date(Date.UTC(numYear + 1, 0, 1));

    const user = await UserModel.findById(userObjectId).exec();
    const incomeType = user?.financialProfile?.incomeType;
    const isPj = incomeType === 'PJ_AUTONOMO' || incomeType === 'ENTREPRENEUR';

    const annualLimit = 81000.0; // Padrão MEI de referência

    if (!isPj) {
      return {
        applicable: false,
        grossRevenueYearToDate: 0,
        annualLimit,
        ceilingPercentage: 0,
        proLaboreTotal: 0,
        dividendsTotal: 0,
      };
    }

    let grossRevenue = 0;
    let proLabore = 0;
    let dividends = 0;

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

    const ceilingPercentage =
      annualLimit > 0
        ? Math.round((grossRevenue / annualLimit) * 1000) / 10
        : 0;

    return {
      applicable: true,
      grossRevenueYearToDate: Math.round(grossRevenue * 100) / 100,
      annualLimit,
      ceilingPercentage,
      proLaboreTotal: Math.round(proLabore * 100) / 100,
      dividendsTotal: Math.round(dividends * 100) / 100,
    };
  }

  /**
   * Localiza transações bancárias de débito que correspondam ao valor e à data do comprovante.
   */
  public static async findSuggestedMatches(
    userId: string,
    totalAmount?: number,
    issueDateStr?: string
  ): Promise<
    Array<{
      transactionId: string;
      date: Date;
      amount: number;
      cleanDescription: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }>
  > {
    if (totalAmount === undefined || totalAmount <= 0) {
      return [];
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const targetAmount = -Math.abs(totalAmount);

    let startDate: Date;
    let endDate: Date;

    if (issueDateStr && !isNaN(Date.parse(issueDateStr))) {
      const issueDate = new Date(issueDateStr);
      startDate = new Date(issueDate.getTime() - 5 * 24 * 60 * 60 * 1000);
      endDate = new Date(issueDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    } else {
      const now = new Date();
      startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    }

    const matchingTxs = await TransactionModel.find({
      userId: userObjectId,
      amount: targetAmount,
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: -1 })
      .limit(5)
      .exec();

    return matchingTxs.map((t) => ({
      transactionId: t._id.toString(),
      date: t.date,
      amount: t.amount,
      cleanDescription: t.cleanDescription,
      confidence: (issueDateStr ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM',
    }));
  }

  /**
   * Obtém os registros detalhados de despesas dedutíveis para composição do dossiê fiscal anual.
   */
  public static async getDossierRecords(
    userId: string,
    year: string
  ): Promise<IFiscalDossierRecord[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const numYear = parseInt(year, 10);
    const startDate = new Date(Date.UTC(numYear, 0, 1));
    const endDate = new Date(Date.UTC(numYear + 1, 0, 1));

    const transactions = await TransactionModel.find({
      userId: userObjectId,
      date: { $gte: startDate, $lt: endDate },
      'fiscal.isTaxDeductible': true,
    })
      .sort({ date: 1 })
      .exec();

    return transactions.map((t) => ({
      date: t.date,
      description: t.cleanDescription || t.rawDescription || 'Sem descrição',
      taxCategory: t.fiscal?.taxCategory,
      providerName: t.fiscal?.providerName,
      providerDocument: t.fiscal?.providerDocument,
      deductibleAmount: t.fiscal?.deductibleAmount ?? Math.abs(t.amount),
      status: t.fiscal?.status || 'PENDING',
    }));
  }
}

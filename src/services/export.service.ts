import mongoose, { Types } from 'mongoose';
import { AccountModel } from '../models/account.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { UserModel } from '../models/user.model.js';
import { ExportTransactionsQuery } from '../schemas/export.schemas.js';

export class AccountAccessDeniedError extends Error {
  public statusCode = 404;
  constructor(message = 'Conta bancária informada não encontrada.') {
    super(message);
    this.name = 'AccountAccessDeniedError';
  }
}

export interface IExportRecord {
  date: Date;
  dateFormatted: string; // "DD/MM/YYYY"
  description: string;   // cleanDescription ou rawDescription
  category: string;      // Categoria canônica
  accountName: string;   // Nome da conta resolvida ou "Sem Conta"
  type: 'RECEITA' | 'DESPESA' | 'PAGAMENTO_FATURA';
  amount: number;        // Valor numérico com sinal original
  amountFormatted: string; // Ex: "R$ 1.250,00" ou "-R$ 45,90"
  decimalFormatted: string; // Ex: "1250,00" ou "-45,90" (para CSV)
}

export interface IExportSummaryMetrics {
  totalCount: number;
  totalIncome: number;     // Soma de entradas (> 0 e categoria Receita)
  totalExpenses: number;   // Soma de despesas (< 0, excluindo pagamentos de fatura para neutralização)
  netBalance: number;      // Balanço líquido do período filtrado
  periodLabel: string;     // Ex: "Outubro/2026" ou "01/10/2026 até 30/10/2026"
  generatedAt: Date;
}

export interface IExportDataResult {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  records: IExportRecord[];
  metrics: IExportSummaryMetrics;
  filenamePeriod: string;
}

export class ExportService {
  /**
   * Formata uma data no formato brasileiro DD/MM/YYYY.
   */
  public static formatDateBR(date: Date): string {
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formata número para moeda brasileira (ex: "R$ 1.250,50" ou "-R$ 45,00").
   */
  public static formatCurrencyBR(amount: number): string {
    const isNegative = amount < 0;
    const absVal = Math.abs(amount).toFixed(2);
    const [intPart, decPart] = absVal.split('.');
    const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formattedVal = `${formattedInt},${decPart}`;
    return isNegative ? `-R$ ${formattedVal}` : `R$ ${formattedVal}`;
  }

  /**
   * Formata número para decimal brasileiro sem símbolo monetário (ex: "1250,50" ou "-45,00").
   */
  public static formatDecimalBR(amount: number): string {
    const isNegative = amount < 0;
    const absVal = Math.abs(amount).toFixed(2);
    const [intPart, decPart] = absVal.split('.');
    const formattedVal = `${intPart},${decPart}`;
    return isNegative ? `-${formattedVal}` : formattedVal;
  }

  /**
   * Extrai e formata os dados de exportação com validação de multi-tenancy e filtros.
   */
  public static async getExportData(
    userId: string,
    query: ExportTransactionsQuery
  ): Promise<IExportDataResult> {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Validar posse da conta caso accountId seja fornecido
    if (query.accountId) {
      if (!Types.ObjectId.isValid(query.accountId)) {
        throw new AccountAccessDeniedError();
      }
      const account = await AccountModel.findOne({
        _id: new Types.ObjectId(query.accountId),
        userId: userObjectId,
      }).exec();

      if (!account) {
        throw new AccountAccessDeniedError();
      }
    }

    // 2. Buscar dados do usuário para o relatório
    const userDoc = await UserModel.findById(userObjectId).select('email name').exec();
    const user = {
      id: userId,
      email: userDoc?.email || '',
      name: userDoc?.name,
    };

    // 3. Montar query do MongoDB
    const mongoQuery: Record<string, any> = { userId: userObjectId };

    if (query.accountId) {
      mongoQuery.accountId = new Types.ObjectId(query.accountId);
    }

    if (query.category) {
      mongoQuery.category = query.category;
    }

    // Período de datas
    let periodLabel = 'Todo o Histórico';
    let filenamePeriod = 'completo';

    if (query.month) {
      const [yearStr, monthStr] = query.month.split('-');
      const year = parseInt(yearStr!, 10);
      const month = parseInt(monthStr!, 10);

      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      mongoQuery.date = { $gte: start, $lte: end };
      periodLabel = `${monthStr}/${yearStr}`;
      filenamePeriod = `${query.month}`;
    } else if (query.startDate || query.endDate) {
      const dateFilter: Record<string, any> = {};
      if (query.startDate) {
        const [y, m, d] = query.startDate.split('-').map(Number);
        dateFilter.$gte = new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
      }
      if (query.endDate) {
        const [y, m, d] = query.endDate.split('-').map(Number);
        dateFilter.$lte = new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999));
      }
      mongoQuery.date = dateFilter;

      const startLabel = query.startDate ? this.formatDateBR(new Date(query.startDate + 'T00:00:00Z')) : 'Início';
      const endLabel = query.endDate ? this.formatDateBR(new Date(query.endDate + 'T00:00:00Z')) : 'Hoje';
      periodLabel = `${startLabel} até ${endLabel}`;
      filenamePeriod = `${query.startDate || 'inicio'}_a_${query.endDate || 'hoje'}`;
    }

    // 4. Carregar mapa de contas do usuário
    const userAccounts = await AccountModel.find({ userId: userObjectId }).select('_id name').lean().exec();
    const accountMap = new Map<string, string>();
    for (const acc of userAccounts) {
      accountMap.set(acc._id.toString(), acc.name);
    }

    // 5. Buscar transações no MongoDB
    const transactions = await TransactionModel.find(mongoQuery)
      .sort({ date: -1, _id: -1 })
      .lean()
      .exec();

    // 6. Mapear para registros e calcular métricas
    let totalIncome = 0;
    let totalExpenses = 0;

    const records: IExportRecord[] = transactions.map((tx) => {
      const isInvoicePayment = tx.category === 'Pagamento de Fatura';
      const isIncome = tx.amount > 0;
      
      let type: 'RECEITA' | 'DESPESA' | 'PAGAMENTO_FATURA' = 'DESPESA';
      if (isInvoicePayment) {
        type = 'PAGAMENTO_FATURA';
      } else if (isIncome) {
        type = 'RECEITA';
      }

      if (isIncome) {
        totalIncome += tx.amount;
      } else if (!isInvoicePayment) {
        totalExpenses += Math.abs(tx.amount);
      }

      const accountName = tx.accountId ? accountMap.get(tx.accountId.toString()) || 'Conta Principal' : 'Sem Conta';
      const description = tx.cleanDescription || tx.rawDescription || 'Sem Descrição';

      return {
        date: tx.date,
        dateFormatted: this.formatDateBR(tx.date),
        description,
        category: tx.category,
        accountName,
        type,
        amount: tx.amount,
        amountFormatted: this.formatCurrencyBR(tx.amount),
        decimalFormatted: this.formatDecimalBR(tx.amount),
      };
    });

    const netBalance = totalIncome - totalExpenses;

    const metrics: IExportSummaryMetrics = {
      totalCount: records.length,
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
      periodLabel,
      generatedAt: new Date(),
    };

    return {
      user,
      records,
      metrics,
      filenamePeriod,
    };
  }
}

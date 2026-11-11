import mongoose, { Types } from 'mongoose';
import { DEFAULT_ACCOUNT_NAME } from '../config/constants.js';
import { AccountModel, IAccount } from '../models/account.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import {
  AccountResponseItem,
  CreateAccountBody,
  ListAccountsResponse,
  UpdateAccountBody,
} from '../schemas/account.schemas.js';

export class AccountConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountConflictError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountBadRequestError';
  }
}

export class AccountService {
  /**
   * Converte um documento IAccount e suas métricas para o formato de resposta da API
   */
  public static toResponseItem(
    account: IAccount,
    balance: number,
    transactionCount: number
  ): AccountResponseItem {
    return {
      id: account._id.toString(),
      userId: account.userId.toString(),
      name: account.name,
      type: account.type,
      initialBalance: account.initialBalance,
      institution: account.institution,
      color: account.color,
      balance,
      transactionCount,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  /**
   * Busca uma conta por ID garantindo isolamento multi-tenant
   */
  public static async findByIdAndUser(
    accountId: string,
    userId: string
  ): Promise<IAccount | null> {
    if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    return AccountModel.findOne({
      _id: new Types.ObjectId(accountId),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  /**
   * Cria uma nova conta para o usuário validando unicidade de nome
   */
  public static async createAccount(
    userId: string,
    body: CreateAccountBody
  ): Promise<AccountResponseItem> {
    const userObjectId = new Types.ObjectId(userId);

    const existing = await AccountModel.findOne({
      userId: userObjectId,
      name: body.name,
    }).exec();

    if (existing) {
      throw new AccountConflictError(`Já existe uma conta com o nome "${body.name}" para este usuário.`);
    }

    try {
      const created = await AccountModel.create({
        userId: userObjectId,
        name: body.name,
        type: body.type,
        initialBalance: body.initialBalance ?? 0,
        institution: body.institution,
        color: body.color ?? '#64748B',
      });

      return this.toResponseItem(created, created.initialBalance, 0);
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AccountConflictError(`Já existe uma conta com o nome "${body.name}" para este usuário.`);
      }
      throw err;
    }
  }

  /**
   * Lista as contas do usuário com saldo consolidado (initialBalance + transações) e contagem
   */
  public static async listAccountsWithBalances(userId: string): Promise<ListAccountsResponse> {
    const userObjectId = new Types.ObjectId(userId);

    let accounts: IAccount[] = await AccountModel.find({ userId: userObjectId }).sort({ createdAt: 1 }).exec();

    // Se o usuário não possuir nenhuma conta ativa, auto-provisiona a Conta Principal
    if (accounts.length === 0) {
      const defaultAccount = await this.getOrCreateDefaultAccount(userId);
      accounts = [defaultAccount];
    }

    // Agregação de transações vinculadas por accountId
    const aggregationResults = await TransactionModel.aggregate<{
      _id: Types.ObjectId | null;
      transactionsTotal: number;
      count: number;
    }>([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: '$accountId',
          transactionsTotal: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const metricsByAccountId = new Map<string, { total: number; count: number }>();
    for (const group of aggregationResults) {
      if (group._id) {
        metricsByAccountId.set(group._id.toString(), {
          total: group.transactionsTotal,
          count: group.count,
        });
      }
    }

    let netWorth = 0;
    const responseAccounts: AccountResponseItem[] = [];

    for (const acc of accounts) {
      const metrics = metricsByAccountId.get(acc._id.toString()) ?? { total: 0, count: 0 };
      const balance = acc.initialBalance + metrics.total;
      netWorth += balance;

      responseAccounts.push(this.toResponseItem(acc, balance, metrics.count));
    }

    return {
      accounts: responseAccounts,
      totalAccounts: responseAccounts.length,
      netWorth,
    };
  }

  /**
   * Atualiza as propriedades de uma conta existente
   */
  public static async updateAccount(
    userId: string,
    accountId: string,
    body: UpdateAccountBody
  ): Promise<AccountResponseItem> {
    const userObjectId = new Types.ObjectId(userId);
    const accountObjectId = new Types.ObjectId(accountId);

    const account = await AccountModel.findOne({
      _id: accountObjectId,
      userId: userObjectId,
    }).exec();

    if (!account) {
      throw new AccountNotFoundError('Conta não encontrada ou acesso não autorizado.');
    }

    if (body.name && body.name !== account.name) {
      const existing = await AccountModel.findOne({
        userId: userObjectId,
        name: body.name,
        _id: { $ne: accountObjectId },
      }).exec();

      if (existing) {
        throw new AccountConflictError(`Já existe uma conta com o nome "${body.name}" para este usuário.`);
      }
      account.name = body.name;
    }

    if (body.type !== undefined) account.type = body.type;
    if (body.initialBalance !== undefined) account.initialBalance = body.initialBalance;
    if (body.institution !== undefined) account.institution = body.institution;
    if (body.color !== undefined) account.color = body.color;

    await account.save();

    // Calcula saldo e contagem atualizados
    const metricsResult = await TransactionModel.aggregate<{ total: number; count: number }>([
      { $match: { userId: userObjectId, accountId: accountObjectId } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const metrics = metricsResult[0] ?? { total: 0, count: 0 };
    const balance = account.initialBalance + metrics.total;

    return this.toResponseItem(account, balance, metrics.count);
  }

  /**
   * Exclui uma conta aplicando política segura (bloqueio 409 vs cascata e proteção de conta única)
   */
  public static async deleteAccount(
    userId: string,
    accountId: string,
    cascade = false
  ): Promise<{ deletedCount: number; transactionsDeleted: number }> {
    const userObjectId = new Types.ObjectId(userId);
    const accountObjectId = new Types.ObjectId(accountId);

    const account = await AccountModel.findOne({
      _id: accountObjectId,
      userId: userObjectId,
    }).exec();

    if (!account) {
      throw new AccountNotFoundError('Conta não encontrada ou acesso não autorizado.');
    }

    // Impede a exclusão se for a única conta restante do usuário
    const totalUserAccounts = await AccountModel.countDocuments({ userId: userObjectId }).exec();
    if (totalUserAccounts <= 1) {
      throw new AccountBadRequestError('Não é permitido excluir a única conta ativa do usuário.');
    }

    const linkedTransactionsCount = await TransactionModel.countDocuments({
      userId: userObjectId,
      accountId: accountObjectId,
    }).exec();

    if (linkedTransactionsCount > 0 && !cascade) {
      throw new AccountConflictError(
        `A conta possui ${linkedTransactionsCount} transações vinculadas. Para excluir a conta juntamente com todas as suas transações, utilize ?cascade=true.`
      );
    }

    let transactionsDeleted = 0;
    if (linkedTransactionsCount > 0 && cascade) {
      const txDeleteResult = await TransactionModel.deleteMany({
        userId: userObjectId,
        accountId: accountObjectId,
      }).exec();
      transactionsDeleted = txDeleteResult.deletedCount;
    }

    const accDeleteResult = await AccountModel.deleteOne({
      _id: accountObjectId,
      userId: userObjectId,
    }).exec();

    return {
      deletedCount: accDeleteResult.deletedCount,
      transactionsDeleted,
    };
  }

  /**
   * Garante a existência da Conta Principal padrão e migra transações legadas sem conta
   */
  public static async getOrCreateDefaultAccount(userId: string): Promise<IAccount> {
    const userObjectId = new Types.ObjectId(userId);

    let defaultAccount = await AccountModel.findOne({
      userId: userObjectId,
      name: DEFAULT_ACCOUNT_NAME,
    }).exec();

    if (!defaultAccount) {
      // Verifica se o usuário tem qualquer conta já criada
      const anyAccount = await AccountModel.findOne({ userId: userObjectId }).sort({ createdAt: 1 }).exec();
      if (anyAccount) {
        defaultAccount = anyAccount;
      } else {
        defaultAccount = await AccountModel.create({
          userId: userObjectId,
          name: DEFAULT_ACCOUNT_NAME,
          type: 'CHECKING',
          initialBalance: 0,
          color: '#2563EB',
        });
      }
    }

    // Migra transações legadas que não possuem accountId associado
    await TransactionModel.updateMany(
      {
        userId: userObjectId,
        $or: [{ accountId: { $exists: false } }, { accountId: null }],
      },
      {
        $set: { accountId: defaultAccount._id },
      }
    ).exec();

    return defaultAccount;
  }
}

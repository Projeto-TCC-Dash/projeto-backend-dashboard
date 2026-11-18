import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  Category,
  FiscalVerificationStatus,
  TaxCategory,
} from '../src/config/constants.js';
import { env } from '../src/config/env.js';
import { AccountModel } from '../src/models/account.model.js';
import { TransactionModel } from '../src/models/transaction.model.js';
import { UserModel } from '../src/models/user.model.js';
import { AnalysisService } from '../src/services/analysis.service.js';
import { SEED_CONFIG } from './seed.js';

export interface ExtraTransactionFiscal {
  isTaxDeductible: boolean;
  taxCategory?: TaxCategory;
  providerDocument?: string;
  providerName?: string;
  deductibleAmount?: number;
  status: FiscalVerificationStatus;
  verifiedAt?: Date;
}

export interface ExtraSyntheticTransaction {
  externalId: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  date: Date;
  category: Category;
  source: 'SEED';
  fiscal?: ExtraTransactionFiscal;
}

export interface SeedExtraOptions {
  email?: string;
  month?: string; // YYYY-MM
  count?: number;
  batchId?: string;
}

export interface SeedExtraResult {
  userId: string;
  email: string;
  month: string;
  batchId: string;
  transactionsInserted: number;
  duplicatesIgnored: number;
  totalIncomeAdded: number;
  totalExpensesAdded: number;
}

interface TransactionTemplate {
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  category: Category;
  accountPreference: 'CHECKING' | 'CREDIT_CARD';
  fiscal?: Omit<ExtraTransactionFiscal, 'verifiedAt'>;
}

const EXTRA_TEMPLATES: readonly TransactionTemplate[] = [
  {
    rawDescription: 'TED RECEBIDA CLIENTE ALPHA CONSULTORIA PJ',
    cleanDescription: 'CONSULTORIA ALPHA PJ',
    amount: 4850.0,
    category: 'Receita',
    accountPreference: 'CHECKING',
  },
  {
    rawDescription: 'COMPRA CARTAO IFOOD *RESTAURANTE SP',
    cleanDescription: 'IFOOD RESTAURANTE',
    amount: -118.9,
    category: 'Alimentação',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'CONSULTA ODONTOLOGICA CLINICA SORRISO LTDA',
    cleanDescription: 'CLINICA ODONTO SORRISO',
    amount: -380.0,
    category: 'Saúde',
    accountPreference: 'CREDIT_CARD',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'HEALTH',
      providerDocument: '12345678000195',
      providerName: 'Clínica Odontológica Sorriso Ltda',
      deductibleAmount: 380.0,
      status: 'CONFIRMED',
    },
  },
  {
    rawDescription: 'SUPERMERCADO ST MARCHE COMPRAS MES',
    cleanDescription: 'SUPERMERCADO ST MARCHE',
    amount: -389.5,
    category: 'Alimentação',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'UBER *TRIP AEROPORTO CONGONHAS',
    cleanDescription: 'UBER TRIP AEROPORTO',
    amount: -64.8,
    category: 'Transporte',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'PAGTO PIX PRO LABORE SOCIO ADMINISTRADOR',
    cleanDescription: 'PAGAMENTO PRO LABORE MENSAL',
    amount: -2500.0,
    category: 'Outros',
    accountPreference: 'CHECKING',
  },
  {
    rawDescription: 'MENSALIDADE MBA GESTAO FINANCEIRA FGV',
    cleanDescription: 'MBA FGV EDUCACAO',
    amount: -690.0,
    category: 'Educação',
    accountPreference: 'CREDIT_CARD',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'EDUCATION',
      providerDocument: '33641663000144',
      providerName: 'Fundação Getulio Vargas',
      deductibleAmount: 690.0,
      status: 'PENDING',
    },
  },
  {
    rawDescription: 'PIX RECEBIDO DESENVOLVIMENTO SOFTWARE FREELA',
    cleanDescription: 'FREELANCE SOFTWARE PJ',
    amount: 2200.0,
    category: 'Receita',
    accountPreference: 'CHECKING',
  },
  {
    rawDescription: 'DEBITO AUTOMATICO COMGAS DISTRIBUICAO',
    cleanDescription: 'COMGAS DISTRIBUICAO',
    amount: -112.4,
    category: 'Moradia',
    accountPreference: 'CHECKING',
  },
  {
    rawDescription: 'SESSAO PSICOTERAPIA DRA MARINA COSTA',
    cleanDescription: 'PSICOTERAPIA DRA MARINA',
    amount: -260.0,
    category: 'Saúde',
    accountPreference: 'CHECKING',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'HEALTH',
      providerDocument: '12345678901',
      providerName: 'Marina Costa Psicologia',
      deductibleAmount: 260.0,
      status: 'PENDING',
    },
  },
  {
    rawDescription: 'POSTO SHELL SELECT COMBUSTIVEL',
    cleanDescription: 'POSTO SHELL COMBUSTIVEL',
    amount: -215.0,
    category: 'Transporte',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'APORTE PREVIDENCIA PRIVADA PGBL ITAU',
    cleanDescription: 'PREVIDENCIA PGBL ITAU',
    amount: -800.0,
    category: 'Outros',
    accountPreference: 'CHECKING',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'PENSION_PGBL',
      providerDocument: '60701190000104',
      providerName: 'Itaú Vida e Previdência S.A.',
      deductibleAmount: 800.0,
      status: 'CONFIRMED',
    },
  },
  {
    rawDescription: 'INGRESSO.COM CINEMA E TEATRO',
    cleanDescription: 'INGRESSO COM LAZER',
    amount: -134.0,
    category: 'Lazer',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'COWORKING WEWORK SALA LIVRO CAIXA PJ',
    cleanDescription: 'COWORKING WEWORK',
    amount: -450.0,
    category: 'Outros',
    accountPreference: 'CREDIT_CARD',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'BUSINESS_EXPENSE_BOOK',
      providerDocument: '26401194000180',
      providerName: 'WeWork Serviços de Escritório Ltda',
      deductibleAmount: 450.0,
      status: 'CONFIRMED',
    },
  },
  {
    rawDescription: 'RESTAURANTE JAPONES KOI SUSHI SP',
    cleanDescription: 'RESTAURANTE KOI SUSHI',
    amount: -186.5,
    category: 'Alimentação',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'TRANSFERENCIA DISTRIBUICAO LUCRO TRIMESTRAL',
    cleanDescription: 'DISTRIBUICAO LUCRO PJ',
    amount: -3200.0,
    category: 'Outros',
    accountPreference: 'CHECKING',
  },
  {
    rawDescription: 'ESTAPAR ESTACIONAMENTO CENTRO SP',
    cleanDescription: 'ESTAPAR ESTACIONAMENTO',
    amount: -48.0,
    category: 'Transporte',
    accountPreference: 'CREDIT_CARD',
  },
  {
    rawDescription: 'WORKSHOP ARQUITETURA CLOUD CERTIFICACAO',
    cleanDescription: 'WORKSHOP CLOUD TECH',
    amount: -320.0,
    category: 'Educação',
    accountPreference: 'CREDIT_CARD',
    fiscal: {
      isTaxDeductible: true,
      taxCategory: 'EDUCATION',
      providerDocument: '44556677000188',
      providerName: 'Cloud Academy Brasil',
      deductibleAmount: 320.0,
      status: 'CONFIRMED',
    },
  },
];

/**
 * Faz parsing seguro dos argumentos de linha de comando (`--email=`, `--month=`, `--count=`, `--batch=`).
 */
export function parseSeedExtraArgs(argv: string[]): SeedExtraOptions {
  const options: SeedExtraOptions = {};

  for (const arg of argv) {
    if (arg.startsWith('--email=')) {
      options.email = arg.slice('--email='.length).trim();
    } else if (arg.startsWith('--month=')) {
      const m = arg.slice('--month='.length).trim();
      if (/^\d{4}-\d{2}$/.test(m)) {
        options.month = m;
      } else {
        throw new Error(`Formato inválido para --month="${m}". Use YYYY-MM (ex: 2026-11).`);
      }
    } else if (arg.startsWith('--count=')) {
      const parsed = Number.parseInt(arg.slice('--count='.length), 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 200) {
        throw new Error('O parâmetro --count deve ser um inteiro entre 1 e 200.');
      }
      options.count = parsed;
    } else if (arg.startsWith('--batch=')) {
      options.batchId = arg.slice('--batch='.length).trim();
    }
  }

  return options;
}

/**
 * Gera um lote de transações extras para o mês informado (padrão: mês atual).
 */
export function generateCurrentMonthTransactions(params?: {
  month?: string;
  count?: number;
  batchId?: string;
  now?: Date;
}): {
  month: string;
  batchId: string;
  transactions: Array<ExtraSyntheticTransaction & { accountPreference: 'CHECKING' | 'CREDIT_CARD' }>;
} {
  const referenceNow = params?.now ?? new Date();
  let targetYear = referenceNow.getUTCFullYear();
  let targetMonthIndex = referenceNow.getUTCMonth();

  if (params?.month) {
    const [yStr, mStr] = params.month.split('-');
    const parsedYear = Number.parseInt(yStr ?? '', 10);
    const parsedMonth = Number.parseInt(mStr ?? '', 10) - 1;
    if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) {
      targetYear = parsedYear;
      targetMonthIndex = parsedMonth;
    }
  }

  const monthStr = String(targetMonthIndex + 1).padStart(2, '0');
  const resolvedMonth = `${targetYear}-${monthStr}`;
  const count = params?.count ?? 15;
  const batchId =
    params?.batchId ||
    `${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

  const isCurrentMonth =
    targetYear === referenceNow.getUTCFullYear() &&
    targetMonthIndex === referenceNow.getUTCMonth();

  // Evita gerar datas futuras se for o mês corrente, mantendo sempre dias válidos (1..28)
  const maxDay = isCurrentMonth
    ? Math.max(1, Math.min(28, referenceNow.getUTCDate()))
    : 28;

  const transactions: Array<
    ExtraSyntheticTransaction & { accountPreference: 'CHECKING' | 'CREDIT_CARD' }
  > = [];

  for (let i = 0; i < count; i++) {
    const template = EXTRA_TEMPLATES[i % EXTRA_TEMPLATES.length]!;
    const cycle = Math.floor(i / EXTRA_TEMPLATES.length);

    // Pequena variação determinística de centavos/valores quando o lote repete templates
    const factor = cycle === 0 ? 1 : 1 + ((cycle % 5) * 0.07);
    const adjustedAmount = Math.round(template.amount * factor * 100) / 100;

    const day = (i % maxDay) + 1;
    const hour = 8 + (i % 12);
    const minute = (i * 11) % 60;
    const txDate = new Date(Date.UTC(targetYear, targetMonthIndex, day, hour, minute, 0));

    const seqStr = String(i + 1).padStart(3, '0');
    const suffix = cycle > 0 ? ` (#${cycle + 1})` : '';

    let fiscal: ExtraTransactionFiscal | undefined;
    if (template.fiscal) {
      fiscal = {
        ...template.fiscal,
        deductibleAmount: Math.abs(adjustedAmount),
        verifiedAt: template.fiscal.status === 'CONFIRMED' ? txDate : undefined,
      };
    }

    transactions.push({
      externalId: `extra-${resolvedMonth}-${batchId}-${seqStr}`,
      rawDescription: `${template.rawDescription}${suffix}`,
      cleanDescription: `${template.cleanDescription}${suffix}`,
      amount: adjustedAmount,
      date: txDate,
      category: template.category,
      source: 'SEED',
      accountPreference: template.accountPreference,
      fiscal,
    });
  }

  return {
    month: resolvedMonth,
    batchId,
    transactions,
  };
}

/**
 * Popula transações adicionais apenas para o mês atual (ou --month especificado),
 * preservando integralmente orçamentos, carteira de investimentos e lançamentos já existentes.
 */
export async function runSeedExtra(options: SeedExtraOptions = {}): Promise<SeedExtraResult> {
  const email = options.email || process.env.SEED_EMAIL || SEED_CONFIG.EMAIL;
  const count = options.count ?? 15;

  console.log(`🌱 Adicionando lote extra de ${count} transações para ${email}...`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() }).exec();
  if (!user) {
    throw new Error(
      `Usuário "${email}" não encontrado. Execute "npm run seed" primeiro ou cadastre o usuário antes de adicionar transações extras.`
    );
  }

  const userId = user._id.toString();

  // Resolver contas existentes do usuário (sem sobrescrever configurações)
  let checkingAccount = await AccountModel.findOne({
    userId: user._id,
    type: 'CHECKING',
  }).exec();

  if (!checkingAccount) {
    checkingAccount = await AccountModel.create({
      userId: user._id,
      name: 'Conta Principal',
      type: 'CHECKING',
      initialBalance: 0,
      institution: 'Nubank',
      color: '#2563EB',
    });
  }

  const creditCardAccount = await AccountModel.findOne({
    userId: user._id,
    type: 'CREDIT_CARD',
  }).exec();

  const generated = generateCurrentMonthTransactions({
    month: options.month,
    count,
    batchId: options.batchId,
  });

  const operations = generated.transactions.map((t) => {
    const targetAccountId =
      t.accountPreference === 'CREDIT_CARD' && creditCardAccount
        ? creditCardAccount._id
        : checkingAccount._id;

    return {
      updateOne: {
        filter: {
          userId: user._id,
          externalId: t.externalId,
        },
        update: {
          $setOnInsert: {
            userId: user._id,
            accountId: targetAccountId,
            externalId: t.externalId,
            rawDescription: t.rawDescription,
            cleanDescription: t.cleanDescription,
            amount: t.amount,
            date: t.date,
            category: t.category,
            source: t.source,
            ...(t.fiscal ? { fiscal: t.fiscal } : {}),
          },
        },
        upsert: true,
      },
    };
  });

  const bulkResult = await TransactionModel.bulkWrite(operations, { ordered: false });
  const transactionsInserted = bulkResult.upsertedCount;
  const duplicatesIgnored = generated.transactions.length - transactionsInserted;

  let totalIncomeAdded = 0;
  let totalExpensesAdded = 0;
  for (const t of generated.transactions) {
    if (t.amount > 0) {
      totalIncomeAdded += t.amount;
    } else {
      totalExpensesAdded += Math.abs(t.amount);
    }
  }

  if (transactionsInserted > 0) {
    try {
      await AnalysisService.invalidate(userId);
    } catch {
      // Cache invalidation não deve bloquear a população de dados
    }
  }

  console.log(`✅ Mês alvo: ${generated.month} | Lote: ${generated.batchId}`);
  console.log(
    `✅ Transações processadas: ${transactionsInserted} inseridas, ${duplicatesIgnored} ignoradas (já existentes).`
  );
  console.log(
    `💰 Volume do lote -> Receitas: R$ ${totalIncomeAdded.toFixed(2)} | Despesas: R$ ${totalExpensesAdded.toFixed(2)}`
  );

  return {
    userId,
    email: user.email,
    month: generated.month,
    batchId: generated.batchId,
    transactionsInserted,
    duplicatesIgnored,
    totalIncomeAdded: Math.round(totalIncomeAdded * 100) / 100,
    totalExpensesAdded: Math.round(totalExpensesAdded * 100) / 100,
  };
}

// Execução direta via CLI: npm run seed:extra -- [--count=20] [--month=2026-11] [--email=...] [--batch=...]
if (process.argv[1] && process.argv[1].endsWith('seed-extra.ts')) {
  const cliOptions = parseSeedExtraArgs(process.argv.slice(2));
  runSeedExtra(cliOptions)
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Falha ao popular transações extras:', err instanceof Error ? err.message : err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

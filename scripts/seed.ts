import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Category } from '../src/config/constants.js';
import { env } from '../src/config/env.js';
import { AccountModel } from '../src/models/account.model.js';
import { TransactionModel } from '../src/models/transaction.model.js';
import { UserModel } from '../src/models/user.model.js';
import { AnalysisService } from '../src/services/analysis.service.js';
import { CryptoService } from '../src/services/crypto.service.js';

export const SEED_CONFIG = {
  EMAIL: 'teste.usuario@exemplo.com',
  PASSWORD: 'SenhaForte#123',
};

export interface SyntheticTransaction {
  externalId: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  date: Date;
  category: Category;
  source: 'SEED';
}

/**
 * Gera um lote determinístico e realista de transações bancárias brasileiras
 * cobrindo o mês atual e o mês anterior em todas as 7 categorias canônicas.
 */
export function generateSyntheticTransactions(baseDate: Date = new Date()): SyntheticTransaction[] {
  const currYear = baseDate.getUTCFullYear();
  const currMonth = baseDate.getUTCMonth(); // 0-indexed

  // Mês anterior (M-1)
  const prevDate = new Date(Date.UTC(currYear, currMonth - 1, 1));
  const prevYear = prevDate.getUTCFullYear();
  const prevMonth = prevDate.getUTCMonth();

  const transactions: SyntheticTransaction[] = [];

  const addTx = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    seq: number,
    rawDescription: string,
    cleanDescription: string,
    amount: number,
    category: Category
  ) => {
    const monthStr = String(month + 1).padStart(2, '0');
    const seqStr = String(seq).padStart(3, '0');
    transactions.push({
      externalId: `seed-${year}-${monthStr}-${seqStr}`,
      rawDescription,
      cleanDescription,
      amount,
      date: new Date(Date.UTC(year, month, day, hour, minute, 0)),
      category,
      source: 'SEED',
    });
  };

  // ==========================================
  // MÊS ATUAL (M) : 21 transações realistas
  // ==========================================
  // Receitas
  addTx(currYear, currMonth, 2, 9, 30, 1, 'TED RECEBIDA TECH CORP SALARIO', 'TECH CORP SALARIO', 7500.0, 'Receita');
  addTx(currYear, currMonth, 15, 14, 0, 2, 'PIX RECEBIDO JOAO SILVA FREELANCE', 'PIX RECEBIDO JOAO FREELANCE', 1200.0, 'Receita');

  // Moradia
  addTx(currYear, currMonth, 5, 10, 0, 3, 'PAGTO BOLETO QUINTOANDAR ALUGUEL', 'QUINTOANDAR ALUGUEL', -2200.0, 'Moradia');
  addTx(currYear, currMonth, 7, 8, 30, 4, 'DEBITO AUTOMATICO ENEL DISTRIBUICAO', 'ENEL DISTRIBUICAO', -195.3, 'Moradia');
  addTx(currYear, currMonth, 8, 11, 15, 5, 'PAGTO ELETRONICO CLARO FIBRA', 'CLARO FIBRA', -149.9, 'Moradia');

  // Alimentação
  addTx(currYear, currMonth, 6, 16, 45, 6, 'COMPRA CARTAO PAO DE ACUCAR SP', 'PAO DE ACUCAR', -580.4, 'Alimentação');
  addTx(currYear, currMonth, 12, 20, 30, 7, 'RESTAURANTE OUTBACK STEAKHOUSE', 'RESTAURANTE OUTBACK', -215.0, 'Alimentação');
  addTx(currYear, currMonth, 16, 18, 10, 8, 'SUPERMERCADO CARREFOUR LOJA', 'SUPERMERCADO CARREFOUR', -420.6, 'Alimentação');
  addTx(currYear, currMonth, 20, 8, 15, 9, 'PADARIA REAL LANCHES E CAFE', 'PADARIA REAL', -45.5, 'Alimentação');

  // Transporte
  addTx(currYear, currMonth, 9, 8, 50, 10, 'UBER *TRIP SAO PAULO BR', 'UBER TRIP', -38.5, 'Transporte');
  addTx(currYear, currMonth, 10, 17, 30, 11, 'POSTO IPIRANGA COMBUSTIVEL', 'POSTO IPIRANGA', -240.0, 'Transporte');
  addTx(currYear, currMonth, 14, 7, 40, 12, 'RECARGA BILHETE UNICO METRO', 'BILHETE UNICO METRO', -100.0, 'Transporte');
  addTx(currYear, currMonth, 21, 19, 20, 13, 'UBER *TRIP SAO PAULO BR', 'UBER TRIP', -42.1, 'Transporte');

  // Saúde
  addTx(currYear, currMonth, 11, 13, 10, 14, 'DROGA RAIA MEDICAMENTOS', 'DROGA RAIA', -142.8, 'Saúde');
  addTx(currYear, currMonth, 17, 10, 0, 15, 'LABORATORIO FLEURY EXAMES', 'LABORATORIO FLEURY', -310.0, 'Saúde');

  // Lazer
  addTx(currYear, currMonth, 13, 9, 0, 16, 'NETFLIX.COM MENSALIDADE', 'NETFLIX COM', -55.9, 'Lazer');
  addTx(currYear, currMonth, 14, 15, 0, 17, 'SPOTIFY BRASIL ASSINATURA', 'SPOTIFY BRASIL', -34.9, 'Lazer');
  addTx(currYear, currMonth, 19, 21, 15, 18, 'CINEMARK BRASIL INGRESSOS', 'CINEMARK BRASIL', -86.0, 'Lazer');

  // Educação
  addTx(currYear, currMonth, 18, 14, 20, 19, 'ALURA CURSOS ONLINE TECNOLOGIA', 'ALURA CURSOS ONLINE', -110.0, 'Educação');
  addTx(currYear, currMonth, 22, 16, 40, 20, 'LIVRARIA DA VILA LIVROS', 'LIVRARIA DA VILA', -129.9, 'Educação');

  // Outros
  addTx(currYear, currMonth, 23, 11, 0, 21, 'TARIFA BANCARIA MANUTENCAO PACOTE', 'TARIFA BANCARIA PACOTE', -49.9, 'Outros');

  // ==========================================
  // MÊS ANTERIOR (M-1) : 19 transações realistas
  // ==========================================
  // Receitas
  addTx(prevYear, prevMonth, 2, 9, 30, 101, 'TED RECEBIDA TECH CORP SALARIO', 'TECH CORP SALARIO', 7500.0, 'Receita');
  addTx(prevYear, prevMonth, 25, 12, 0, 102, 'RENDIMENTO APLICACAO CDB LIQUIDO', 'RENDIMENTO CDB LIQUIDO', 285.5, 'Receita');

  // Moradia
  addTx(prevYear, prevMonth, 5, 10, 0, 103, 'PAGTO BOLETO QUINTOANDAR ALUGUEL', 'QUINTOANDAR ALUGUEL', -2200.0, 'Moradia');
  addTx(prevYear, prevMonth, 7, 8, 30, 104, 'DEBITO AUTOMATICO ENEL DISTRIBUICAO', 'ENEL DISTRIBUICAO', -210.4, 'Moradia');
  addTx(prevYear, prevMonth, 8, 11, 15, 105, 'PAGTO ELETRONICO CLARO FIBRA', 'CLARO FIBRA', -149.9, 'Moradia');

  // Alimentação
  addTx(prevYear, prevMonth, 6, 17, 0, 106, 'COMPRA CARTAO PAO DE ACUCAR SP', 'PAO DE ACUCAR', -612.3, 'Alimentação');
  addTx(prevYear, prevMonth, 12, 20, 0, 107, 'RESTAURANTE OUTBACK STEAKHOUSE', 'RESTAURANTE OUTBACK', -195.0, 'Alimentação');
  addTx(prevYear, prevMonth, 16, 18, 30, 108, 'SUPERMERCADO CARREFOUR LOJA', 'SUPERMERCADO CARREFOUR', -489.2, 'Alimentação');
  addTx(prevYear, prevMonth, 20, 8, 45, 109, 'PADARIA REAL LANCHES E CAFE', 'PADARIA REAL', -52.8, 'Alimentação');

  // Transporte
  addTx(prevYear, prevMonth, 9, 9, 10, 110, 'UBER *TRIP SAO PAULO BR', 'UBER TRIP', -52.0, 'Transporte');
  addTx(prevYear, prevMonth, 10, 18, 0, 111, 'POSTO IPIRANGA COMBUSTIVEL', 'POSTO IPIRANGA', -230.0, 'Transporte');
  addTx(prevYear, prevMonth, 22, 14, 0, 112, 'OFICINA MECANICA AUTO CENTER', 'OFICINA MECANICA AUTO', -350.0, 'Transporte');

  // Saúde
  addTx(prevYear, prevMonth, 11, 11, 30, 113, 'DROGA RAIA MEDICAMENTOS', 'DROGA RAIA', -98.5, 'Saúde');
  addTx(prevYear, prevMonth, 17, 7, 0, 114, 'SMART FIT MENSALIDADE ACADEMIA', 'SMART FIT ACADEMIA', -139.9, 'Saúde');

  // Lazer
  addTx(prevYear, prevMonth, 13, 9, 0, 115, 'NETFLIX.COM MENSALIDADE', 'NETFLIX COM', -55.9, 'Lazer');
  addTx(prevYear, prevMonth, 14, 15, 0, 116, 'SPOTIFY BRASIL ASSINATURA', 'SPOTIFY BRASIL', -34.9, 'Lazer');
  addTx(prevYear, prevMonth, 19, 21, 0, 117, 'INGRESSO RAPIDO SHOW E TEATRO', 'INGRESSO RAPIDO', -180.0, 'Lazer');

  // Educação
  addTx(prevYear, prevMonth, 18, 16, 0, 118, 'CURSO INGLES ONLINE PLATAFORMA', 'CURSO INGLES ONLINE', -250.0, 'Educação');

  // Outros
  addTx(prevYear, prevMonth, 23, 11, 0, 119, 'TARIFA BANCARIA MANUTENCAO PACOTE', 'TARIFA BANCARIA PACOTE', -49.9, 'Outros');

  return transactions;
}

export async function runSeed(): Promise<{
  userId: string;
  email: string;
  transactionsImported: number;
  hasAiKey: boolean;
  analysisCached: boolean;
}> {
  console.log('🌱 Iniciando Seed Sintético Local de Teste...');

  // 1. Conexão ao MongoDB se não conectado
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  }

  // 2. Criação ou recuperação idempotente do usuário de teste
  let user = await UserModel.findOne({ email: SEED_CONFIG.EMAIL }).exec();
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(SEED_CONFIG.PASSWORD, salt);
    user = await UserModel.create({
      email: SEED_CONFIG.EMAIL,
      passwordHash,
    });
    console.log(`✅ Usuário criado com sucesso: ${SEED_CONFIG.EMAIL}`);
  } else {
    console.log(`ℹ️ Usuário de teste já existente: ${SEED_CONFIG.EMAIL}`);
  }

  // 3. Vinculação automática da chave do Google AI Studio a partir do .env
  const devApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (devApiKey && !devApiKey.includes('sua-chave')) {
    try {
      const encrypted = CryptoService.encrypt(devApiKey);
      user.encryptedApiKey = encrypted.encryptedText;
      user.iv = encrypted.iv;
      user.authTag = encrypted.authTag;
      await user.save();
      console.log('🔑 Chave GOOGLE_GENERATIVE_AI_API_KEY do .env criptografada e vinculada ao usuário.');
    } catch (err: any) {
      console.warn('⚠️ Falha ao vincular chave do .env:', err?.message || err);
    }
  } else {
    console.warn('⚠️ GOOGLE_GENERATIVE_AI_API_KEY padrão não configurada no .env. Chave não vinculada.');
  }

  const userId = user._id.toString();

  // 3.1 Provisionamento determinístico de contas bancárias (Conta Corrente e Cartão de Crédito)
  let checkingAccount = await AccountModel.findOne({ userId: user._id, name: 'Conta Principal' }).exec();
  if (!checkingAccount) {
    checkingAccount = await AccountModel.create({
      userId: user._id,
      name: 'Conta Principal',
      type: 'CHECKING',
      initialBalance: 3500,
      institution: 'Nubank',
      color: '#2563EB',
    });
  }

  let creditCardAccount = await AccountModel.findOne({ userId: user._id, name: 'Cartão Nubank Roxinho' }).exec();
  if (!creditCardAccount) {
    creditCardAccount = await AccountModel.create({
      userId: user._id,
      name: 'Cartão Nubank Roxinho',
      type: 'CREDIT_CARD',
      initialBalance: 0,
      institution: 'Nu Pagamentos',
      color: '#820AD1',
    });
  }

  // 4. Ingestão 100% local e autônoma de transações sintéticas (Multi-mês e Multi-categoria)
  const syntheticTransactions = generateSyntheticTransactions();
  const operations = syntheticTransactions.map((t) => {
    const isChecking = t.category === 'Receita' || t.category === 'Moradia';
    const targetAccountId = isChecking ? checkingAccount!._id : creditCardAccount!._id;

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
          },
        },
        upsert: true,
      },
    };
  });

  const result = await TransactionModel.bulkWrite(operations, { ordered: false });
  const transactionsImported = result.upsertedCount;
  const duplicatesIgnored = syntheticTransactions.length - transactionsImported;

  // Migra quaisquer transações pré-existentes sem conta para a conta corrente principal
  await TransactionModel.updateMany(
    { userId: user._id, accountId: { $exists: false } },
    { $set: { accountId: checkingAccount._id } }
  ).exec();

  console.log(
    `✅ Transações sintéticas processadas: ${transactionsImported} novas inseridas, ${duplicatesIgnored} já existentes.`
  );

  // 5. Pre-warming da análise financeira do mês atual no cache
  const currentMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  let analysisCached = false;

  try {
    if (user.hasAiKey()) {
      console.log(`🧠 Pré-aquecendo análise financeira do mês atual (${currentMonth})...`);
      const analysis = await AnalysisService.getAnalysis(userId, currentMonth);
      analysisCached = true;
      console.log(`✅ Análise pré-aquecida no cache! (cached: ${analysis.cached})`);
    } else {
      console.log('ℹ️ Usuário sem chave AI configurada; pre-warming da análise ignorado.');
    }
  } catch (analysisErr: any) {
    console.warn('⚠️ Pré-aquecimento da análise financeira não executado:', analysisErr?.message || analysisErr);
  }

  console.log('\n🎉 Seed local finalizado com sucesso!');
  console.log(`   Credenciais de Teste:`);
  console.log(`   - E-mail: ${SEED_CONFIG.EMAIL}`);
  console.log(`   - Senha:  ${SEED_CONFIG.PASSWORD}\n`);

  return {
    userId,
    email: user.email,
    transactionsImported,
    hasAiKey: user.hasAiKey(),
    analysisCached,
  };
}

// Execução direta via CLI: npm run seed
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Falha na execução do seed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

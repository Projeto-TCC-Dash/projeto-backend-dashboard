import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/user.model.js';
import { AnalysisService } from '../src/services/analysis.service.js';
import { CryptoService } from '../src/services/crypto.service.js';
import { ParsedTransaction } from '../src/services/parser.service.js';
import { PluggyService } from '../src/services/pluggy.service.js';
import { SanitizerService } from '../src/services/sanitizer.service.js';
import { TransactionService } from '../src/services/transaction.service.js';

export const SEED_CONFIG = {
  EMAIL: 'teste.pluggy@exemplo.com',
  PASSWORD: 'SenhaForte#123',
  PLUGGY_ITEM_ID: '87c6b485-6bbd-4e96-a81d-872f9b2d8801',
};

export const MOCK_PLUGGY_FIXTURES: ParsedTransaction[] = [
  {
    externalId: 'pluggy-seed-001',
    rawDescription: 'TED RECEBIDA EMPRESA XYZ SALARIO',
    cleanDescription: 'EMPRESA XYZ SALARIO',
    amount: 6200.0,
    date: new Date('2026-10-02T10:00:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-002',
    rawDescription: 'COMPRA CARTAO PAO DE ACUCAR SP',
    cleanDescription: 'PAO DE ACUCAR',
    amount: -520.4,
    date: new Date('2026-10-04T15:30:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-003',
    rawDescription: 'PAGTO ELETRONICO ENEL DISTRIBUICAO',
    cleanDescription: 'ENEL DISTRIBUICAO',
    amount: -195.2,
    date: new Date('2026-10-06T11:00:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-004',
    rawDescription: 'UBER *TRIP SAO PAULO BR',
    cleanDescription: 'UBER TRIP',
    amount: -48.9,
    date: new Date('2026-10-08T09:20:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-005',
    rawDescription: 'POSTO IPIRANGA COMBUSTIVEL',
    cleanDescription: 'POSTO IPIRANGA',
    amount: -220.0,
    date: new Date('2026-10-09T17:45:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-006',
    rawDescription: 'DROGA RAIA FARMACIA MEDICAMENTOS',
    cleanDescription: 'DROGA RAIA',
    amount: -135.5,
    date: new Date('2026-10-10T14:10:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-007',
    rawDescription: 'RESTAURANTE OUTBACK STEAKHOUSE',
    cleanDescription: 'RESTAURANTE OUTBACK',
    amount: -189.0,
    date: new Date('2026-10-11T20:30:00Z'),
    source: 'PLUGGY',
  },
  {
    externalId: 'pluggy-seed-008',
    rawDescription: 'NETFLIX.COM MENSALIDADE ASSINATURA',
    cleanDescription: 'NETFLIX COM',
    amount: -55.9,
    date: new Date('2026-10-12T08:00:00Z'),
    source: 'PLUGGY',
  },
];

export async function runSeed(): Promise<{
  userId: string;
  email: string;
  transactionsImported: number;
  hasAiKey: boolean;
  analysisCached: boolean;
}> {
  console.log('🌱 Iniciando Seed Automatizado de Teste...');

  // 1. Conexão ao MongoDB se não conectado
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
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

  // 4. Ingestão de dados da Sandbox da Pluggy (ou Fixture de contingência)
  let importStats = { imported: 0, duplicatesIgnored: 0 };
  let usedFallback = false;

  try {
    if (env.PLUGGY_API_KEY && !env.PLUGGY_API_KEY.includes('sua-chave')) {
      console.log('📡 Conectando à Sandbox da Pluggy, criando conexão dinâmica e sincronizando lançamentos...');
      const syncResult = await PluggyService.createAndSyncSandboxItem(userId);
      importStats = {
        imported: syncResult.imported,
        duplicatesIgnored: syncResult.duplicatesIgnored,
      };
      console.log(`✅ Transações importadas dinamicamente da Pluggy: ${syncResult.imported} novas (${syncResult.totalExtracted} coletadas), ${syncResult.duplicatesIgnored} já existentes.`);
    } else {
      usedFallback = true;
    }
  } catch (pluggyErr: any) {
    console.warn('⚠️ Não foi possível sincronizar diretamente com a Pluggy Sandbox:', pluggyErr?.message || pluggyErr);
    usedFallback = true;
  }

  if (usedFallback) {
    console.log('📦 Aplicando fixture simulada de transações da sandbox da Pluggy...');
    const result = await TransactionService.importTransactions(userId, MOCK_PLUGGY_FIXTURES);
    importStats = {
      imported: result.imported,
      duplicatesIgnored: result.duplicatesIgnored,
    };
    console.log(`✅ Fixture Pluggy importada: ${result.imported} novas, ${result.duplicatesIgnored} já existentes.`);

    // Categorização padrão inicial para as fixtures
    await TransactionService.reassociateCategories(userId, {
      'EMPRESA XYZ SALARIO': 'Outros',
      'PAO DE ACUCAR': 'Alimentação',
      'ENEL DISTRIBUICAO': 'Moradia',
      'UBER TRIP': 'Transporte',
      'POSTO IPIRANGA': 'Transporte',
      'DROGA RAIA': 'Saúde',
      'RESTAURANTE OUTBACK': 'Alimentação',
      'NETFLIX COM': 'Lazer',
    });
  }

  // 5. Pre-warming da análise financeira do mês
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

  console.log('\n🎉 Seed finalizado com sucesso!');
  console.log(`   Credenciais de Teste:`);
  console.log(`   - E-mail: ${SEED_CONFIG.EMAIL}`);
  console.log(`   - Senha:  ${SEED_CONFIG.PASSWORD}\n`);

  return {
    userId,
    email: user.email,
    transactionsImported: importStats.imported,
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

import mongoose from 'mongoose';
import { UserModel } from '../src/models/user.model.js';
import { TransactionModel } from '../src/models/transaction.model.js';
import { FinancialAnalysisModel } from '../src/models/analysis.model.js';
import { AnalysisService } from '../src/services/analysis.service.js';

async function warmupMonth(userId: mongoose.Types.ObjectId, year: number, monthNum: number, monthLabel: string) {
  const month = `${year}-${String(monthNum).padStart(2, '0')}`;
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNum, 1));

  const transactions = await TransactionModel.find({
    userId,
    date: { $gte: startDate, $lt: endDate },
  }).sort({ date: -1 });

  if (transactions.length === 0) {
    console.log(`⚠️ Nenhuma transação encontrada para ${month}`);
    return;
  }

  console.log(`Encontradas ${transactions.length} transações para ${month}`);

  const stateHash = AnalysisService.calculateStateHash(transactions);
  const metrics = AnalysisService.calculateMetrics(transactions);

  const diagnosis = `Excelente gestão orçamentária neste mês de ${monthLabel}. Sua renda líquida totalizou R$ ${metrics.totalIncome.toFixed(2)}, enquanto as despesas essenciais e variáveis somaram R$ ${metrics.totalExpenses.toFixed(2)}, resultando em um superávit positivo de R$ ${metrics.netBalance.toFixed(2)}. Sua taxa de poupança atingiu ${metrics.savingsRate}%, um patamar saudável para o crescimento do patrimônio pessoal.`;

  const recommendations = [
    `Direcionar parte do superávit mensal de R$ ${metrics.netBalance.toFixed(2)} para a consolidação da reserva de emergência em aplicações com liquidez diária (ex: Tesouro Selic ou CDB 100% CDI).`,
    'Auditar despesas com Alimentação fora de casa e Lazer para identificar potenciais otimizações sem prejuízo da qualidade de vida.',
    'Revisar cobranças recorrentes e assinaturas de streaming para evitar acúmulo de custos invisíveis no orçamento.',
    'Programar aportes automáticos logo após o recebimento do salário para consolidar o hábito de pagar a si mesmo primeiro.',
  ];

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  await FinancialAnalysisModel.findOneAndUpdate(
    { userId, month },
    {
      $set: {
        transactionStateHash: stateHash,
        diagnosis,
        recommendations,
        metrics,
        generatedAt: now,
        expiresAt,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Análise aquecida com sucesso para ${month}!`);
}

async function main() {
  await mongoose.connect('mongodb://localhost:27017/financial_db');
  console.log('MongoDB conectado');

  const user = await UserModel.findOne({ email: 'teste.usuario@exemplo.com' });
  if (!user) {
    console.error('Usuário não encontrado');
    process.exit(1);
  }

  await warmupMonth(user._id, 2026, 10, 'outubro');
  await warmupMonth(user._id, 2026, 11, 'novembro');

  await mongoose.disconnect();
}

main().catch(console.error);

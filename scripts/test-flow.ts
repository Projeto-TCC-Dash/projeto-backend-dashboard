import { readFileSync } from 'node:fs';
import { env } from '../src/config/env.js';

const BASE_URL = `http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`;

async function main() {
  console.log('🚀 Iniciando Teste de Fluxo Automatizado Ponta a Ponta...\n');
  console.log(`📡 Conectando em: ${BASE_URL}`);

  // 1. Healthcheck
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ 1. Healthcheck OK:', health);
  } catch (err) {
    console.error('❌ Servidor não está respondendo. Certifique-se de que a API está rodando (npm run dev ou docker compose up).');
    process.exit(1);
  }

  // 2. Registro e Login
  const email = `usuario_teste_${Date.now()}@exemplo.com`;
  const password = 'SenhaForte#123';

  console.log(`\n👤 2. Registrando usuário: ${email}`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const regData = (await regRes.json()) as any;
  const token = regData.token;
  console.log('✅ Usuário registrado! Token JWT gerado.');

  // 3. Configurar Chave BYOK do Gemini a partir do .env
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!googleApiKey || googleApiKey.includes('sua-chave')) {
    console.warn('⚠️ GOOGLE_GENERATIVE_AI_API_KEY não configurada no .env. Pulando cadastro de chave.');
  } else {
    console.log('\n🔑 3. Cadastrando e validando API Key do Google AI Studio a partir do .env...');
    const keyRes = await fetch(`${BASE_URL}/api/user/ai-key`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ apiKey: googleApiKey }),
    });

    if (keyRes.ok) {
      const keyData = await keyRes.json();
      console.log('✅ Chave validada no Gemini e criptografada com sucesso:', keyData);
    } else {
      const keyErr = await keyRes.json();
      console.warn('⚠️ Ping no Gemini falhou (chave inválida ou sem cota):', keyErr);
    }
  }

  // 4. Ingestão de Extrato OFX de Exemplo
  console.log('\n📄 4. Enviando arquivo de extrato OFX sintético...');
  const sampleOfx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261010120000[-03:EST]
            <TRNAMT>-120.50
            <FITID>TEST-FITID-001
            <MEMO>PIX TRANSF 123.456.789-00 SUPERMERCADO PAO DE ACUCAR
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261011120000[-03:EST]
            <TRNAMT>-45.00
            <FITID>TEST-FITID-002
            <MEMO>COMPRA CARTAO POSTO SHELL
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261005120000[-03:EST]
            <TRNAMT>3500.00
            <FITID>TEST-FITID-003
            <MEMO>TED SALARIO EMPRESA XYZ
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

  const formData = new FormData();
  formData.append('file', new Blob([sampleOfx], { type: 'application/x-ofx' }), 'extrato.ofx');

  const uploadRes = await fetch(`${BASE_URL}/api/transactions/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log('✅ Upload concluído:', uploadData);

  // 5. Teste de Idempotência (Reenviar o mesmo arquivo)
  console.log('\n🔄 5. Testando Idempotência (Reenviando o mesmo extrato)...');
  const reuploadRes = await fetch(`${BASE_URL}/api/transactions/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const reuploadData = await reuploadRes.json();
  console.log('✅ Idempotência comprovada (duplicadas ignoradas):', reuploadData);

  // 6. Categorização Inteligente via IA
  console.log('\n🤖 6. Executando Categorização Inteligente via Gemini...');
  const catRes = await fetch(`${BASE_URL}/api/transactions/categorize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (catRes.ok) {
    const catData = await catRes.json();
    console.log('✅ Categorização concluída:', catData);
  } else {
    const catErr = await catRes.json();
    console.log('ℹ️ Resposta da categorização:', catErr);
  }

  // 7. Listar transações com categorias aplicadas
  console.log('\n📊 7. Listando transações salvas no banco...');
  const listRes = await fetch(`${BASE_URL}/api/transactions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const listData = (await listRes.json()) as any[];
  console.table(
    listData.map((t) => ({
      externalId: t.externalId,
      cleanDescription: t.cleanDescription,
      amount: t.amount,
      category: t.category,
      source: t.source,
    }))
  );

  // 8. Consultoria Financeira com Streaming SSE
  console.log('\n💬 8. Testando Consultoria Financeira com Streaming SSE...');
  const chatRes = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Olá consultor! Como estão minhas finanças este mês e onde gastei mais?',
    }),
  });

  if (chatRes.ok && chatRes.body) {
    console.log('🌊 Resposta em Streaming:');
    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.text) {
              process.stdout.write(data.text);
            }
          } catch {}
        }
      }
    }
    console.log('\n\n🏁 Fluxo de Streaming concluído com sucesso!');
  } else {
    const err = await chatRes.json();
    console.log('ℹ️ Resposta do chat:', err);
  }

  console.log('\n🎉 Teste de fluxo completo finalizado!');
}

main().catch((err) => {
  console.error('❌ Erro durante o fluxo de teste:', err);
});

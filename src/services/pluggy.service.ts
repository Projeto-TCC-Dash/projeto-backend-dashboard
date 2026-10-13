import { env } from '../config/env.js';
import { ParsedTransaction } from './parser.service.js';
import { SanitizerService } from './sanitizer.service.js';
import { TransactionService } from './transaction.service.js';

interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  type?: string;
}

interface PluggyAccount {
  id: string;
  name: string;
}

interface PluggyItem {
  id: string;
  status: 'UPDATING' | 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED' | string;
  executionStatus?: string;
}

export class PluggyService {
  private static readonly BASE_URL = 'https://api.pluggy.ai';

  /**
   * Obtém os headers de autenticação para as chamadas à API da Pluggy.
   */
  private static getHeaders(): Record<string, string> {
    const apiKey = env.PLUGGY_API_KEY;
    if (!apiKey) {
      throw new Error('PLUGGY_API_KEY não configurada no ambiente.');
    }
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    };
  }

  /**
   * Cria uma conexão dinâmica na Sandbox da Pluggy (conector 2 com credenciais de teste)
   * e aguarda a sincronização completa (status UPDATED).
   */
  public static async createSandboxItem(connectorId: number = 2): Promise<string> {
    const headers = this.getHeaders();

    console.log(`📡 Conectando à API da Pluggy para criar Item na Sandbox (conector ${connectorId})...`);

    const createRes = await fetch(`${this.BASE_URL}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        connectorId,
        parameters: {
          user: 'user-ok',
          password: 'password-ok',
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Falha ao criar item na Sandbox da Pluggy: ${createRes.status} ${errText}`);
    }

    const item = (await createRes.json()) as PluggyItem;
    const itemId = item.id;
    console.log(`✅ Item de Sandbox criado na Pluggy: ${itemId}. Aguardando sincronização...`);

    // Polling até status UPDATED (timeout máximo de 30s)
    const startTime = Date.now();
    const timeoutMs = 30000;
    const pollIntervalMs = 2000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusRes = await fetch(`${this.BASE_URL}/items/${itemId}`, { headers });
      if (!statusRes.ok) {
        continue;
      }

      const currentItem = (await statusRes.json()) as PluggyItem;
      console.log(`⏳ Status da conexão Pluggy: ${currentItem.status}`);

      if (currentItem.status === 'UPDATED') {
        console.log('🎉 Sincronização da Sandbox Pluggy concluída com sucesso!');
        return itemId;
      }

      if (currentItem.status === 'LOGIN_ERROR' || currentItem.status === 'OUTDATED') {
        throw new Error(`Falha na sincronização do item na Pluggy com status: ${currentItem.status}`);
      }
    }

    console.warn('⚠️ Timeout atingido aguardando status UPDATED. Tentando prosseguir com o itemId gerado...');
    return itemId;
  }

  /**
   * Busca contas e transações da Pluggy sandbox para o itemId informado e normaliza para o esquema canônico.
   */
  public static async fetchTransactionsByItem(itemId: string): Promise<ParsedTransaction[]> {
    const headers = this.getHeaders();

    // 1. Buscar contas vinculadas ao Item
    const accountsRes = await fetch(`${this.BASE_URL}/accounts?itemId=${itemId}`, {
      headers,
    });

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      throw new Error(`Falha ao buscar contas na Pluggy: ${accountsRes.status} ${errText}`);
    }

    const accountsData = (await accountsRes.json()) as { results?: PluggyAccount[] } | PluggyAccount[];
    const accounts: PluggyAccount[] = Array.isArray(accountsData)
      ? accountsData
      : accountsData.results || [];

    const normalizedTransactions: ParsedTransaction[] = [];

    // 2. Para cada conta, buscar transações
    for (const acc of accounts) {
      const txRes = await fetch(`${this.BASE_URL}/transactions?accountId=${acc.id}&pageSize=100`, {
        headers,
      });

      if (!txRes.ok) {
        continue;
      }

      const txData = (await txRes.json()) as { results?: PluggyTransaction[] } | PluggyTransaction[];
      const txs: PluggyTransaction[] = Array.isArray(txData) ? txData : txData.results || [];

      for (const t of txs) {
        const rawDesc = t.description || 'Lançamento Pluggy';
        normalizedTransactions.push({
          externalId: t.id,
          rawDescription: rawDesc,
          cleanDescription: SanitizerService.cleanDescription(rawDesc),
          amount: t.amount,
          date: new Date(t.date),
          source: 'PLUGGY' as any,
        });
      }
    }

    return normalizedTransactions;
  }

  /**
   * Cria autonomamente uma conexão de teste na Sandbox da Pluggy, extrai todas as contas
   * e transações simuladas e importa com idempotência no MongoDB.
   */
  public static async createAndSyncSandboxItem(userId: string, connectorId: number = 2) {
    const itemId = await this.createSandboxItem(connectorId);
    const transactions = await this.fetchTransactionsByItem(itemId);
    const importStats = await TransactionService.importTransactions(userId, transactions);

    return {
      itemId,
      ...importStats,
    };
  }

  /**
   * Sincroniza um item pré-existente da Pluggy e persiste no MongoDB com idempotência.
   */
  public static async syncItem(userId: string, itemId: string) {
    const transactions = await this.fetchTransactionsByItem(itemId);
    return TransactionService.importTransactions(userId, transactions);
  }
}

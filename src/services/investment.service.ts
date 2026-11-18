import mongoose from 'mongoose';
import { ASSET_MACRO_CLASSES, AssetMacroClass } from '../config/constants.js';
import { AccountModel } from '../models/account.model.js';
import { InvestmentHoldingModel } from '../models/investment-holding.model.js';
import { UserModel } from '../models/user.model.js';
import {
  InvestmentHoldingItem,
  InvestmentPortfolioSummary,
  UpsertInvestmentHoldingBody,
} from '../schemas/investment.schemas.js';

export class InvestmentService {
  /**
   * Obtém a visão consolidada da carteira de investimentos do usuário por macroclasses,
   * calculando percentuais e diagnosticando aderência ao perfil de risco.
   */
  public static async getPortfolioSummary(
    userId: string
  ): Promise<InvestmentPortfolioSummary> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const holdings = await InvestmentHoldingModel.find({
      userId: userObjectId,
    }).exec();

    // Somar montantes por macroclasse
    const macroClassSum: Record<AssetMacroClass, number> = {} as any;
    for (const mc of ASSET_MACRO_CLASSES) {
      macroClassSum[mc] = 0;
    }

    let totalInvested = 0;
    for (const h of holdings) {
      macroClassSum[h.macroClass] = (macroClassSum[h.macroClass] || 0) + h.amount;
      totalInvested += h.amount;
    }

    totalInvested = Math.round(totalInvested * 100) / 100;

    const holdingsSummary: InvestmentHoldingItem[] = ASSET_MACRO_CLASSES.map((mc) => {
      const amount = Math.round((macroClassSum[mc] || 0) * 100) / 100;
      const percentage =
        totalInvested > 0 ? Math.round((amount / totalInvested) * 1000) / 10 : 0;
      return { macroClass: mc, amount, percentage };
    });

    // Consultar perfil do usuário
    const user = await UserModel.findById(userObjectId).exec();
    const riskProfile = user?.financialProfile?.riskProfile;
    const goals = user?.financialProfile?.goals || [];

    // Calcular ativos voláteis vs defensivos
    const volatileClasses: AssetMacroClass[] = [
      'EQUITIES',
      'REAL_ESTATE',
      'INTERNATIONAL',
      'CRYPTO',
    ];
    let volatilePct = 0;
    for (const vc of volatileClasses) {
      const h = holdingsSummary.find((item) => item.macroClass === vc);
      if (h) volatilePct += h.percentage;
    }
    volatilePct = Math.round(volatilePct * 10) / 10;

    let adherent = true;
    const recommendations: string[] = [];

    if (riskProfile === 'CONSERVATIVE') {
      if (volatilePct > 20) {
        adherent = false;
        recommendations.push(
          `Sua carteira possui ${volatilePct.toFixed(1)}% em classes voláteis, acima do recomendado (máximo 20%) para o perfil Conservador. Considere direcionar novos aportes para Renda Fixa ou Liquidez.`
        );
      } else {
        recommendations.push(
          `Sua carteira está bem calibrada com ${((100 - volatilePct)).toFixed(1)}% em ativos defensivos e liquidez imediata, condizente com seu perfil Conservador.`
        );
      }
    } else if (riskProfile === 'MODERATE') {
      if (volatilePct > 50) {
        adherent = false;
        recommendations.push(
          `Sua carteira possui ${volatilePct.toFixed(1)}% em ativos de risco, excedendo o patamar equilibrado (até 50%) para o perfil Moderado.`
        );
      } else {
        recommendations.push(
          'Sua carteira apresenta boa diversificação entre estabilidade e crescimento patrimonial.'
        );
      }
    } else if (riskProfile === 'AGGRESSIVE') {
      recommendations.push(
        'Alocação arrojada focada em crescimento patrimonial e tolerância a volatilidade.'
      );
    } else {
      recommendations.push(
        'Defina seu perfil de risco nas configurações de perfil para receber diagnósticos personalizados de alocação patrimonial.'
      );
    }

    if (goals.includes('QUITAR_DIVIDAS')) {
      recommendations.push(
        'Atenção à meta "Quitar Dívidas": a amortização antecipada de passivos com juros altos costuma proporcionar retorno líquido superior à maioria das aplicações financeiras.'
      );
    }

    return {
      totalInvested,
      riskProfile,
      holdings: holdingsSummary,
      allocationDiagnosis: {
        adherentToRiskProfile: adherent,
        recommendations,
      },
    };
  }

  /**
   * Atualiza ou cadastra uma posição patrimonial em uma macroclasse em uma conta de investimentos.
   */
  public static async upsertHolding(
    userId: string,
    data: UpsertInvestmentHoldingBody
  ): Promise<InvestmentPortfolioSummary | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const accountObjectId = new mongoose.Types.ObjectId(data.accountId);

    // Validar se a conta existe e pertence ao usuário
    const account = await AccountModel.findOne({
      _id: accountObjectId,
      userId: userObjectId,
    }).exec();

    if (!account) {
      return null;
    }

    await InvestmentHoldingModel.findOneAndUpdate(
      {
        userId: userObjectId,
        accountId: accountObjectId,
        macroClass: data.macroClass,
      },
      {
        $set: {
          amount: Math.round(data.amount * 100) / 100,
          notes: data.notes?.trim(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return this.getPortfolioSummary(userId);
  }
}

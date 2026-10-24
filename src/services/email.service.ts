export interface ISentEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  code: string;
  sentAt: Date;
}

export class EmailService {
  private static sentEmails: ISentEmail[] = [];

  /**
   * Envia o código OTP de 6 dígitos para o e-mail cadastrado.
   */
  public static async sendOtpEmail(
    toEmail: string,
    otpCode: string,
    type: 'LOGIN' | 'ENABLE'
  ): Promise<boolean> {
    const isLogin = type === 'LOGIN';
    const actionText = isLogin ? 'autenticação de login' : 'ativação da proteção em duas etapas';
    const subject = isLogin
      ? 'Seu código de verificação 2FA - Plataforma Financeira'
      : 'Confirmação de ativação do 2FA - Plataforma Financeira';

    const text = `Olá!\n\nSeu código de verificação para ${actionText} é: ${otpCode}\n\nEste código expira em 10 minutos.\nSe você não solicitou este código, por favor proteja sua conta e altere sua senha imediatamente.`;

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-top: 0;">Verificação em Duas Etapas (2FA)</h2>
        <p style="color: #475569;">Utilize o código numérico de 6 dígitos abaixo para confirmar sua solicitação de <strong>${actionText}</strong>:</p>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border-radius: 6px; margin: 20px 0;">
          ${otpCode}
        </div>
        <p style="color: #64748b; font-size: 13px;">Este código é válido por <strong>10 minutos</strong> e de uso único.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px;">Se você não realizou esta tentativa, desconsidere esta mensagem ou altere suas credenciais de acesso.</p>
      </div>
    `;

    const record: ISentEmail = {
      to: toEmail,
      subject,
      text,
      html,
      code: otpCode,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[EmailService] ✉️ E-mail OTP enviado para ${toEmail} (${type}): Código [${otpCode}]`);
    }

    return true;
  }

  /**
   * Retorna o último e-mail disparado (utilizado em testes unitários e de integração).
   */
  public static getLastSentEmail(): ISentEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  /**
   * Retorna todos os e-mails enviados.
   */
  public static getSentEmails(): ISentEmail[] {
    return [...this.sentEmails];
  }

  /**
   * Limpa a fila em memória (útil para teardown de testes).
   */
  public static clearSentEmails(): void {
    this.sentEmails = [];
  }
}

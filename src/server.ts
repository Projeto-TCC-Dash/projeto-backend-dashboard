import { buildApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = buildApp();

  try {
    await connectDatabase();

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`🚀 Servidor rodando em http://${env.HOST}:${env.PORT}`);
    console.log(`📚 Documentação Swagger disponível em http://${env.HOST}:${env.PORT}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n🛑 Recebido sinal ${signal}, encerrando graciosamente...`);
      try {
        await app.close();
        await disconnectDatabase();
        process.exit(0);
      } catch (err) {
        console.error('Erro durante encerramento gracioso:', err);
        process.exit(1);
      }
    });
  }
}

bootstrap();

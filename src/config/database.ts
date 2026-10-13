import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('✅ Conexão com MongoDB estabelecida.');
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.error('❌ Erro na conexão com o MongoDB:', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️ Conexão com o MongoDB perdida.');
  });

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
  } catch (error) {
    isConnected = false;
    console.error('❌ Falha ao conectar ao MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌 Conexão com MongoDB encerrada.');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

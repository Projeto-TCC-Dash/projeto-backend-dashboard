import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;
let connectionPromise: Promise<void> | null = null;
let listenersRegistered = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

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
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  if (!connectionPromise) {
    registerConnectionListeners();

    connectionPromise = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => {
        isConnected = true;
      })
      .catch((error) => {
        isConnected = false;
        console.error('❌ Falha ao conectar ao MongoDB:', error);
        throw error;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  await connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
  isConnected = false;
  connectionPromise = null;
  console.log('🔌 Conexão com MongoDB encerrada.');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

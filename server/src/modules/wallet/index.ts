import type { PrismaClient } from '@prisma/client';
import type { ServerConfig } from '../../config.js';
import { createWalletAdminRouter } from './routes/admin.js';
import { createWalletStudentRouter } from './routes/student.js';

export interface WalletModuleOptions {
  prisma: PrismaClient;
  config: ServerConfig;
}

export function createWalletModule(options: WalletModuleOptions) {
  const context = { prisma: options.prisma, config: options.config };
  return {
    studentRouter: createWalletStudentRouter(context),
    adminRouter: createWalletAdminRouter(context),
    context,
  };
}

export type WalletContext = ReturnType<typeof createWalletModule>['context'];

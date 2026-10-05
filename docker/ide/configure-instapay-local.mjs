/** Owner-supplied local receiving details; run via stdin in the retained platform server.
 * Uses platform service validation/concurrency controls. No wallets, ledger or DRM writes. */
import { PrismaClient } from '@prisma/client';
import { saveInstaPay } from './dist/modules/wallet/payment-settings.js';
if (process.env.NODE_ENV === 'production' || new URL(process.env.DATABASE_URL).pathname !== '/education_platform') throw new Error('Retained local database refused');
const prisma = new PrismaClient();
try {
  const desired = {
    enabled: true,
    accountLabel: '+201005344368',
    instructionsAr: 'المستلم: عبدالله طه عبدالله. حوّل عبر InstaPay إلى الرقم الموضّح، ثم أرسل طلب شحن مع مرجع التحويل وإثبات الدفع. يُضاف الرصيد بعد تحقق الإدارة من الاستلام.',
    instructionsEn: 'Recipient: عبدالله طه عبدالله. Transfer through InstaPay to the displayed number, then submit a recharge request with the transfer reference and receipt. Credit is added after admin verification of receipt.',
  };
  const existing = await prisma.instaPaySettings.findUnique({ where: { id: 1 } });
  if (existing) {
    if (Object.entries(desired).some(([key, value]) => existing[key] !== value)) throw new Error('Existing admin receiving settings preserved; manual review needed');
  } else await saveInstaPay(prisma, { ...desired, version: 0 });
  console.log('Owner InstaPay configuration enabled; financial balances unchanged');
} finally { await prisma.$disconnect(); }

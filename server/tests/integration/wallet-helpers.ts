import request from 'supertest';
import type { Express } from 'express';
import { bootstrapFirstAdmin } from '../../src/modules/identity/bootstrap.js';
import {
  createWorld,
  loginWith,
  registerStudent,
  uniqueEmail,
  uniquePhone,
  TEST_ORIGIN,
  uniqueIp,
  type IdentityWorld,
} from './identity-helpers.js';

export const TEST_CHANNELS = [
  { channel: 'INSTAPAY', accountLabel: 'test-alias (test only)', instructionsAr: 'تعليمات', instructionsEn: 'instructions' },
  { channel: 'BANK_TRANSFER', accountLabel: 'test-iban (test only)', instructionsAr: 'تعليمات', instructionsEn: 'instructions' },
] as const;

export interface WalletWorld extends IdentityWorld {
  adminJar: import('./identity-helpers.js').Jar;
  adminUser: { id: string; email: string };
  studentJar: import('./identity-helpers.js').Jar;
  studentUser: { id: string; email: string };
}

export async function createWalletWorld(configured = true): Promise<WalletWorld> {
  const world = await createWorld(
    configured ? ({ paymentChannels: [...TEST_CHANNELS] } as never) : ({ paymentChannels: [] } as never),
  );
  await world.prisma.walletLedgerEntry.deleteMany();
  await world.prisma.wallet.deleteMany();
  await world.prisma.rechargeProof.deleteMany();
  await world.prisma.rechargeRequest.deleteMany();
  await world.prisma.purchase.deleteMany();
  await world.prisma.subscription.deleteMany();
  await world.prisma.auditEvent.deleteMany();

  await world.prisma.user.deleteMany({ where: { role: 'ADMIN' } });
  const admin = await bootstrapFirstAdmin(
    { displayName: 'Wallet Admin', email: uniqueEmail(), phone: uniquePhone(), password: 'wallet secret twelve words' },
    { prisma: world.prisma, argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 } },
  );
  const session = await loginWith(world.app, admin.email, 'wallet secret twelve words');
  const student = await registerStudent(world.app);
  const studentRow = await world.prisma.user.findUniqueOrThrow({ where: { email: student.user.email } });
  const out = world as WalletWorld;
  (out as { adminJar: unknown }).adminJar = session.jar;
  (out as { adminUser: unknown }).adminUser = { id: admin.id, email: admin.email };
  (out as { studentJar: unknown }).studentJar = student.jar;
  (out as { studentUser: unknown }).studentUser = { id: studentRow.id, email: studentRow.email };
  return out;
}

export function studentPost(app: Express, path: string, jar: { header(): string; csrf(): string }, body: Record<string, unknown> = {}) {
  return request(app).post(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);
}

export function studentGet(app: Express, path: string, jar: { header(): string }) {
  return request(app).get(path).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header());
}

let keyCounter = 0;
export function uniqueKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${keyCounter}`.slice(0, 64);
}

export function tinyJpegBase64(): string {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString('base64');
}

export function rechargeBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    amountPiastres: 60000,
    channel: 'INSTAPAY',
    reference: `test-ref-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    senderName: 'Test Sender',
    senderPhone: '+201000000001',
    transferDate: new Date(Date.now() - 86_400_000).toISOString(),
    proofFilename: 'receipt.jpg',
    proofMime: 'image/jpeg',
    proofBase64: tinyJpegBase64(),
    idempotencyKey: uniqueKey('recharge'),
    ...overrides,
  };
}

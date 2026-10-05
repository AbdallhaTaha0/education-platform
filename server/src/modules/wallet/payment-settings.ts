import { Prisma, type PrismaClient } from '@prisma/client';
import type { PaymentChannelConfig } from '../../config.js';
import { ApiError } from '../identity/errors.js';

async function getSettings(prisma: PrismaClient, channels: PaymentChannelConfig[], channel: 'INSTAPAY' | 'MOBILE_WALLET') {
  const select = { enabled: true, accountLabel: true, instructionsAr: true, instructionsEn: true, version: true } as const;
  const row = await (channel === 'INSTAPAY' ? prisma.instaPaySettings.findUnique({ where: { id: 1 }, select: { ...select, qrMime: true } }) : prisma.vodafoneCashSettings.findUnique({ where: { id: 1 }, select }));
  if (row) return { ...row, ...('qrMime' in row ? { qrUrl: row.qrMime ? `/api/admin/payment-settings/instapay/qr?v=${row.version}` : null } : {}) };
  const legacy = channels.find(c => c.channel === channel);
  return { enabled: !!legacy, accountLabel: legacy?.accountLabel ?? '', instructionsAr: legacy?.instructionsAr ?? '', instructionsEn: legacy?.instructionsEn ?? '', version: 0 };
}

export const getInstaPay = (prisma: PrismaClient, channels: PaymentChannelConfig[]) => getSettings(prisma, channels, 'INSTAPAY');
export const getVodafoneCash = (prisma: PrismaClient, channels: PaymentChannelConfig[]) => getSettings(prisma, channels, 'MOBILE_WALLET');

export async function paymentChannels(prisma: PrismaClient, configured: PaymentChannelConfig[]): Promise<PaymentChannelConfig[]> {
  const instapay = await getInstaPay(prisma, configured);
  const vodafone = await getVodafoneCash(prisma, configured);
  return [...configured.filter(c => c.channel !== 'INSTAPAY' && c.channel !== 'MOBILE_WALLET'),
    ...([{ channel: 'INSTAPAY' as const, settings: instapay }, { channel: 'MOBILE_WALLET' as const, settings: vodafone }]
      .filter(c => c.settings.enabled).map(({ channel, settings }) => ({ channel, accountLabel: settings.accountLabel, instructionsAr: settings.instructionsAr, instructionsEn: settings.instructionsEn, ...(channel === 'INSTAPAY' && 'qrUrl' in settings && settings.qrUrl ? { qrUrl: `/api/wallet/payment-settings/instapay/qr?v=${settings.version}` } : {}) })))];
}

async function saveSettings(prisma: PrismaClient, body: unknown, channel: 'INSTAPAY' | 'MOBILE_WALLET') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid receiving details.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(k => !['enabled', 'accountLabel', 'instructionsAr', 'instructionsEn', 'version'].includes(k))) throw new ApiError(400, 'INVALID_FIELD', 'Unknown receiving field.');
  if (typeof input.enabled !== 'boolean' || !Number.isSafeInteger(input.version) || Number(input.version) < 0 || Number(input.version) >= 2147483647) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid receiving settings.');
  function text(key: string, limit: number) {
    const value = input[key];
    if (typeof value !== 'string' || value.trim().length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (input.enabled && !value.trim())) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid receiving details.', { field: key });
    return value.trim();
  }
  const data = { enabled: input.enabled, accountLabel: text('accountLabel', 200), instructionsAr: text('instructionsAr', 2000), instructionsEn: text('instructionsEn', 2000) };
  try {
    return await prisma.$transaction(async tx => {
      if (input.version === 0) return channel === 'INSTAPAY' ? tx.instaPaySettings.create({ data: { id: 1, ...data } }) : tx.vodafoneCashSettings.create({ data: { id: 1, ...data } });
      const update = { where: { id: 1, version: Number(input.version) }, data: { ...data, version: { increment: 1 } } };
      const result = await (channel === 'INSTAPAY' ? tx.instaPaySettings.updateMany(update) : tx.vodafoneCashSettings.updateMany(update));
      if (result.count !== 1) throw new ApiError(409, 'OFFER_CHANGED', 'Receiving details changed. Reload before saving.');
      return channel === 'INSTAPAY' ? tx.instaPaySettings.findUniqueOrThrow({ where: { id: 1 } }) : tx.vodafoneCashSettings.findUniqueOrThrow({ where: { id: 1 } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'OFFER_CHANGED', 'Receiving details changed. Reload before saving.');
    throw error;
  }
}

export const saveInstaPay = (prisma: PrismaClient, body: unknown) => saveSettings(prisma, body, 'INSTAPAY');
export const saveVodafoneCash = (prisma: PrismaClient, body: unknown) => saveSettings(prisma, body, 'MOBILE_WALLET');

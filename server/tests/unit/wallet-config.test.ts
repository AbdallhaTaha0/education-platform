import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

function baseEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    AUTH_JWT_SECRET: 'x'.repeat(32),
    AUTH_ISSUER: 'test-issuer',
    AUTH_AUDIENCE: 'test-audience',
    ALLOWED_ORIGINS: 'http://localhost:8080',
    NODE_ENV: 'test',
  };
}

const channel = {
  channel: 'INSTAPAY',
  accountLabel: 'test-alias (test only)',
  instructionsAr: 'تعليمات',
  instructionsEn: 'instructions',
};

describe('payment channel configuration', () => {
  it('absent configuration is explicitly unconfigured', () => {
    expect(loadConfig(baseEnv()).paymentChannels).toEqual([]);
  });

  it('accepts 1-3 valid channels', () => {
    const cfg = loadConfig({ ...baseEnv(), PAYMENT_CHANNELS: JSON.stringify([channel]) });
    expect(cfg.paymentChannels).toHaveLength(1);
    expect(cfg.paymentChannels[0]?.channel).toBe('INSTAPAY');
  });

  it('fails closed on malformed, unknown, duplicate, or oversized entries', () => {
    const bad = [
      'not-json',
      JSON.stringify([]),
      JSON.stringify([channel, channel]),
      JSON.stringify([{ ...channel, channel: 'CASH' }]),
      JSON.stringify([{ ...channel, accountLabel: '' }]),
      JSON.stringify([channel, channel, channel, channel].slice(0, 4)),
    ];
    for (const raw of bad) {
      expect(() => loadConfig({ ...baseEnv(), PAYMENT_CHANNELS: raw })).toThrow();
    }
  });
});

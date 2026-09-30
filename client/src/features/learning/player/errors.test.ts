import { describe, expect, it } from 'vitest';
import { awaitsEncryptionInitData } from './errors';
describe('DASH encryption initialization', () => {
  it('waits for the encrypted init segment when the manifest has no PSSH', () => {
    expect(awaitsEncryptionInitData({ code: 113, message: 'DRM: unable to create session! -- needkey/encrypted event contains no initData corresponding to that key system!' })).toBe(true);
  });
  it('keeps actual key-session failures fatal', () => {
    expect(awaitsEncryptionInitData({ code: 113, message: 'Error generating key request -- NotSupportedError' })).toBe(false);
  });
  it('never suppresses license denial or malformed errors', () => {
    for (const error of [null, {}, {code:114,message:'license denied'}, {code:112,message:'no initData corresponding to that key system'}]) {
      expect(awaitsEncryptionInitData(error)).toBe(false);
    }
  });
});

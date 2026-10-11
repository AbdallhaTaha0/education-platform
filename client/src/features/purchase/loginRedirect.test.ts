import { afterEach, expect, it, vi } from 'vitest';
import { purchaseAfterLogin, purchaseLoginHash } from './loginRedirect';
import { routeFromHash } from '../../routes';

afterEach(() => vi.unstubAllGlobals());
it('opens login and returns to the selected purchase, including encoded IDs', () => {
  const login = purchaseLoginHash('plan / 1');
  vi.stubGlobal('window', { location: { hash: login, pathname: '/' } });
  expect(routeFromHash()).toBe('login');
  expect(purchaseAfterLogin(login)).toBe('#/purchase/plan%20%2F%201');
});
it.each(['https://example.com', '//example.com', '#/admin', '#/purchase/', '#/purchase/a?extra=1'])('rejects unsafe or unrelated return target %s', next => {
  expect(purchaseAfterLogin(`#/login?next=${encodeURIComponent(next)}`)).toBe('#/account');
});
it('retains the ordinary login destination', () => {
  expect(purchaseAfterLogin('#/login')).toBe('#/account');
});

import { expect, it } from 'vitest';
import { releaseStudentDevice } from '../../src/modules/learning/devices/service.js';

it('reproduces audit loss after successful release, then idempotent retry', async () => {
  let releaseExists = true;
  let auditAttempts = 0;
  const prisma = {
    user: { findUnique: async () => ({id:'00000000-0000-4000-8000-000000000001',role:'STUDENT'}) },
    auditEvent: { create: async () => { auditAttempts++; throw new Error('synthetic audit outage'); } },
  };
  const drm = { releaseUserDevice: async () => { const released=releaseExists;releaseExists=false;return {released}; } };
  const args = [prisma as never, drm as never, 'admin', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', Date.now()] as const;
  const first = await releaseStudentDevice(...args);
  const retry = await releaseStudentDevice(...args);
  expect(first).toEqual({released:true,auditPending:true});
  expect(retry).toEqual({released:false,auditPending:false});
  expect(auditAttempts).toBe(1);
  console.log('DEFECT REPRODUCED: audit failure is forgotten on idempotent retry; no durable audit reconciliation is scheduled.');
});

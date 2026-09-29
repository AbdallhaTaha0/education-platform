import type { PrismaClient } from '@prisma/client';
import { getLogger } from '../../../logger.js';
import { cleanupExpiredProofs } from './service.js';

export interface ProofCleanupScheduler {
  stop: () => void;
}

/** Automatic replica-safe retention enforcement. Every replica may tick:
 * compare-and-set cleanup makes one the winner without duplicate audits. */
export function startProofCleanupScheduler(
  prisma: PrismaClient,
  intervalMs = 60 * 60 * 1000,
  batchLimit = 100,
): ProofCleanupScheduler {
  let stopped = false;
  let running = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      // Bound one tick while still draining ordinary backlogs promptly.
      for (let batch = 0; batch < 10 && !stopped; batch += 1) {
        const result = await cleanupExpiredProofs(prisma, batchLimit);
        if (result.examined < batchLimit) break;
      }
    } catch (err) {
      getLogger().error({ err }, 'proof retention cleanup failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

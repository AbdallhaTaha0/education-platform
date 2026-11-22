import type { PrismaClient } from '@prisma/client';
import { completePendingChoice } from './service.js';
import { codingIdeEnabled } from './availability.js';

/**
 * Legacy BullMQ grading worker retired as part of Cloudflare migration (WP-CF5).
 * Choice quizzes are graded inline inside the modular backend; coding IDE
 * execution remains suspended per the 2026-10-07 owner decision.
 */
export async function processSubmission(
  db: PrismaClient,
  id: string,
  _execute?: unknown,
): Promise<void> {
  if (!codingIdeEnabled()) {
    await completePendingChoice(db, id);
  }
}

export async function reconcileGrading(_db?: PrismaClient, _queue?: unknown): Promise<number> {
  return 0;
}

export async function retainGradingHistory(_db?: PrismaClient, _now?: number): Promise<number> {
  return 0;
}

export async function reconcilePreparations(_db?: PrismaClient, _queue?: unknown): Promise<number> {
  return 0;
}

export async function startAssessmentWorker(db?: PrismaClient): Promise<{ stop: () => Promise<void> }> {
  void db;
  return { stop: async () => undefined };
}

export const startGradingWorker = startAssessmentWorker;

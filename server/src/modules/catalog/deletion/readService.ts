import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { assertUuid } from '../validation.js';

export async function getDeletionOperation(prisma: PrismaClient, operationId: string) {
  assertUuid(operationId, 'operationId');
  const op = await prisma.catalogDeletionOperation.findUnique({
    where: { id: operationId },
    include: { assets: true },
  });
  if (op === null) throw new ApiError(404, 'DELETION_NOT_FOUND', 'Deletion operation not found.');
  return op;
}

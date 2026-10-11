import { ApiError } from '../identity/errors.js';
import type { Content, Answer } from './contracts.js';

/** Release switch. Disabled unless an operator explicitly re-enables execution. */
export function codingIdeEnabled(): boolean {
  return parseCodingIdeEnabled(process.env.CODING_IDE_ENABLED);
}
export function parseCodingIdeEnabled(value: string | undefined): boolean {
  if (value !== undefined && value !== 'true' && value !== 'false') throw new Error('Invalid CODING_IDE_ENABLED (true or false required).');
  return value === 'true';
}
export function requireCodingIde(): void {
  if (!codingIdeEnabled()) throw new ApiError(503, 'IDE_DISABLED', 'Coding practice and assessments are temporarily unavailable.');
}
export function choiceOnly(value: unknown): value is Content {
  const questions = (value as Partial<Content> | null)?.questions;
  return Array.isArray(questions) && questions.length > 0 && questions.every((q) => q.type === 'CHOICE');
}
export function requireAvailableAssessment(value: unknown): void {
  if (!choiceOnly(value)) requireCodingIde();
}
/** Private answer keys stay on the server; safe per-question feedback only. */
export function gradeChoices(c: Content, submitted: Answer[]) {
  const questions = c.questions.map((q) => {
    const correct = submitted.find((a) => a.questionId === q.id)?.choiceId === q.correctChoiceId;
    return { questionId: q.id, correct, checksPassed: correct ? 1 : 0, checksTotal: 1 };
  });
  return { correct: questions.every((q) => q.correct), questions };
}

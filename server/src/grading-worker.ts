import { startGradingWorker } from './modules/assessments/worker.js';
async function main(): Promise<void> {
  const worker = await startGradingWorker(); let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { if (stopping) return; stopping = true; void worker.stop().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; }); });
  process.stdout.write('Grading controller ready\n');
}
main().catch(() => { process.stderr.write('GRADING_STARTUP_FAILED\n'); process.exitCode = 1; });

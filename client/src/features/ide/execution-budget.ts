/** Per browser task: idle time is free; loops and chained microtasks share a budget.
 * Keep this function self-contained: previewDocument serializes it into the frame.
 */
export function createExecutionGuard(clock: () => number, schedule: (reset: () => void) => unknown, ErrorType: ErrorConstructor): () => void {
  let started: number | null = null;
  let steps = 0;
  return () => {
    if (started === null) {
      started = clock();
      schedule(() => { started = null; steps = 0; });
    }
    if (++steps > 200000 || clock() - started > 2000) throw new ErrorType('Execution stopped: time limit');
  };
}

import { describe, expect, it } from 'vitest';
import { createExecutionGuard } from './execution-budget';
describe('preview task execution budget', () => {
  function fixture() {
    let time = 0; const resets: Array<() => void> = [];
    const guard = createExecutionGuard(() => time, reset => resets.push(reset), Error);
    return { guard, advance: (ms: number) => { time += ms; }, nextTask: () => { resets.splice(0).forEach(reset => reset()); }, resets };
  }
  it('does not count idle time before or between user interactions', () => {
    const f = fixture(); f.advance(10000); expect(f.guard).not.toThrow();
    f.nextTask(); f.advance(10000); expect(f.guard).not.toThrow();
  });
  it('bounds time spent within an interaction', () => {
    const f = fixture(); f.guard(); f.advance(2001); expect(f.guard).toThrow('time limit');
    f.nextTask(); expect(f.guard).not.toThrow();
  });
  it('bounds loops and recursion without refreshing at every function call', () => {
    const f = fixture(); for (let i = 0; i < 200000; i++) f.guard();
    expect(f.guard).toThrow('time limit'); expect(f.resets).toHaveLength(1);
    f.nextTask(); expect(f.guard).not.toThrow();
  });
  it('shares the budget with promise microtasks until the next browser task', async () => {
    const f = fixture(); f.guard(); f.advance(2001); await Promise.resolve();
    expect(f.guard).toThrow('time limit');
  });
  it('serializes without depending on parent module bindings', () => {
    const build = Function(`return (${createExecutionGuard.toString()})`)();
    const guard = build(() => 0, () => {}, Error); expect(guard).not.toThrow();
  });
});

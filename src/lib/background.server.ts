import { AsyncLocalStorage } from "node:async_hooks";

type Execution = { waitUntil: (task: Promise<unknown>) => void };
const execution = new AsyncLocalStorage<Execution | undefined>();
export function withExecution<T>(ctx: unknown, run: () => T): T {
  const valid = ctx && typeof ctx === "object" && "waitUntil" in ctx && typeof ctx.waitUntil === "function";
  return execution.run(valid ? ctx as Execution : undefined, run);
}
export function runBackground(task: Promise<unknown>) {
  execution.getStore()?.waitUntil(task);
  void task.catch(() => {});
}
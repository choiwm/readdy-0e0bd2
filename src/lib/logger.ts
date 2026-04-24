/**
 * Dev-only logger — no-op in production.
 * Use for diagnostic traces that should not reach user consoles in a shipped build.
 * For genuine errors use console.error; for recoverable-failure notices use console.warn.
 */
const IS_DEV = import.meta.env.DEV;

export const logDev = IS_DEV
  ? (...args: unknown[]): void => console.log(...args)
  : (): void => {};

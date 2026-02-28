export function goto(path: string): void {
  console.warn(`[svelte-roku] goto("${path}") is a no-op stub in web mode`);
}

export function back(): void {
  console.warn("[svelte-roku] back() is a no-op stub in web mode");
}

export function replace(path: string): void {
  console.warn(`[svelte-roku] replace("${path}") is a no-op stub in web mode`);
}

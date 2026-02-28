export interface RouteConfig {
  path: string;
  component: unknown;
}

export function createRouter(_routes: RouteConfig[]): void {
  console.warn("[svelte-roku] createRouter() is a no-op stub in web mode");
}

export function getCurrentRoute(): string {
  console.warn("[svelte-roku] getCurrentRoute() is a no-op stub in web mode");
  return "/";
}

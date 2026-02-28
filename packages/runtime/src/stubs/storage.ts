export function getItem(key: string): string | null {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(key);
  }
  return null;
}

export function setItem(key: string, value: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, value);
  }
}

export function removeItem(key: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(key);
  }
}

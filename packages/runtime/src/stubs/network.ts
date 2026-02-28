export function rokuFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(url, options);
}

export interface AnimateOptions {
  duration?: number;
  easing?: string;
}

export function animate(
  _nodeId: string,
  _property: string,
  _toValue: unknown,
  _options?: AnimateOptions,
): void {
  // No-op stub in web mode
}

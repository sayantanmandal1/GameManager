export function hasExactActionShape<Type extends string>(
  action: unknown,
  type: Type,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): action is Record<string, unknown> & { type: Type } {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return false;
  const record = action as Record<string, unknown>;
  if (record.type !== type) return false;
  const allowed = new Set(['type', ...requiredKeys, ...optionalKeys]);
  const keys = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  return requiredKeys.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key));
}

export function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}
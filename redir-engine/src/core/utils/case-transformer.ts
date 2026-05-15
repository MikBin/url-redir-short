type CamelCase<S extends string> = S extends `${infer T}${"_" | "-"}${infer U}`
  ? `${Lowercase<T>}${Capitalize<CamelCase<U>>}`
  : S;

export type DeepCamelCase<T> = T extends Array<infer U>
  ? Array<DeepCamelCase<U>>
  : T extends object
  ? { [K in keyof T as CamelCase<K & string>]: DeepCamelCase<T[K]> }
  : T;

/**
 * Recursively transforms all keys of an object from snake_case or kebab-case to camelCase.
 */
export function transformSnakeToCamel<T>(obj: T): DeepCamelCase<T> {
  if (Array.isArray(obj)) {
    return obj.map(v => transformSnakeToCamel(v)) as unknown as DeepCamelCase<T>;
  } else if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;
    
    for (const key of Object.keys(record)) {
      const camelKey = key.replace(/([-_][a-z])/g, group =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );
      result[camelKey] = transformSnakeToCamel(record[key]);
    }
    return result as unknown as DeepCamelCase<T>;
  }
  return obj as unknown as DeepCamelCase<T>;
}

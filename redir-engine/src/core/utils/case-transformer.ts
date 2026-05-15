/**
 * Recursively transforms all keys of an object from snake_case to camelCase.
 */
export function transformSnakeToCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => transformSnakeToCamel(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/([-_][a-z])/g, group =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );
      result[camelKey] = transformSnakeToCamel(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

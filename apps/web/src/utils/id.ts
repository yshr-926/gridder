/**
 * ユニークな ID を生成する
 */
export function generateId(prefix: string = 'obj'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${randomPart}`;
}

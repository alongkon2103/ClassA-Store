function wasAborted(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false
  const value = error as Record<string, unknown>
  if (value.code === 'P2034' || [value.code, value.originalCode].some(code => code === '40P01' || code === '40001')) return true
  return ['cause', 'meta', 'driverAdapterError'].some(key => wasAborted(value[key], depth + 1))
}

/** Only retry errors that guarantee PostgreSQL aborted the whole transaction.
 * The callback must contain database work only; network/points notifications
 * belong after its successful return. Never retry ambiguous commit failures. */
export async function retryAbortedTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await operation() } catch (error) {
      if (attempt >= 3 || !wasAborted(error)) throw error
      await new Promise(resolve => setTimeout(resolve, attempt * 25))
    }
  }
}

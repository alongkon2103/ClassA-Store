import assert from 'node:assert/strict'
import { retryAbortedTransaction } from '../lib/transactionRetry'

async function main() {
  for (const error of [{ code: 'P2034' }, { code: '40P01' }, { code: 'P2010', meta: { code: '40P01' } }, { cause: { originalCode: '40001' } }, { meta: { driverAdapterError: { cause: { originalCode: '40P01' } } } }]) {
    let attempts = 0
    assert.equal(await retryAbortedTransaction(async () => { if (++attempts === 1) throw error; return 'committed' }), 'committed')
    assert.equal(attempts, 2)
  }
  for (const error of [{ code: 'P2002' }, { code: 'P2028' }, new Error('connection lost while committing')]) {
    let attempts = 0
    await assert.rejects(retryAbortedTransaction(async () => { attempts++; throw error }), thrown => thrown === error)
    assert.equal(attempts, 1, 'Unknown/possibly committed failures are never replayed')
  }
  let attempts = 0
  await assert.rejects(retryAbortedTransaction(async () => { attempts++; throw { code: 'P2034' } }))
  assert.equal(attempts, 3, 'Aborted transactions have a bounded retry budget')
  console.log('PASS transaction retry: PostgreSQL/Prisma deadlock and serialization shapes, bounded attempts, no replay after timeout/unknown commit failures')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

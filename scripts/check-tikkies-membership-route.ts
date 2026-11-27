import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {NextRequest} from 'next/server'
const token=randomBytes(40).toString('base64url')
process.env.TIKKIES_API_ENABLED='true';process.env.TIKKIES_API_KEY_SHA256=createHash('sha256').update(token).digest('hex')
let blocked=false
const db={
  $queryRaw:async(parts:TemplateStringsArray,...values:unknown[])=>parts.join().includes('INSERT')?[values[0],values[1]].map(key_hash=>({key_hash,count:blocked?999999:1,reset_at:new Date(Date.now()+60000)})):[],
  $executeRaw:async()=>0,
  $transaction:async(fn:(client:unknown)=>unknown)=>fn(db),
}
const id=require.resolve('../lib/prisma');require.cache[id]={id,filename:id,loaded:true,exports:{prisma:db}} as NodeModule
const {POST}=require('../app/api/integrations/tikkies/membership/route')
const req=(body:unknown,key:string|null=token,query='')=>new NextRequest('https://aclassstore.com/api/integrations/tikkies/membership'+query,{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},body:JSON.stringify(body)})
async function main(){
  assert.equal((await POST(req({email:'x@example.com'},null))).status,401)
  assert.equal((await POST(req({email:'x@example.com'},'invalid'))).status,401)
  for(const body of [{email:null},{email:'bad'},{email:'x@example.com',productId:'other'},{email:'x@example.com',allowed:true}])assert.equal((await POST(req(body))).status,400)
  assert.equal((await POST(req({email:'x@example.com'},token,'?email=other'))).status,400)
  assert.equal((await POST(req({email:'x'.repeat(3000)}))).status,400)
  const result=await POST(req({email:' X@Example.com '}));assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.deepEqual(await result.json(),{email:'x@example.com',allowed:false,expiresAt:null})
  blocked=true;const limited=await POST(req({email:'x@example.com'}));assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'))
  console.log('PASS private membership route: hashed credentials, strict bounded identity, no-store and subject rate limits')
}
main().catch(error=>{console.error(error);process.exitCode=1})

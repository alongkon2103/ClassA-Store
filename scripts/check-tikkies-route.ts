import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { NextRequest } from "next/server"
import { authenticateTikkies } from "../lib/integrations/tikkiesSecurity"
const require = createRequire(import.meta.url)
const token="tikkies_test_"+"a".repeat(48), previous="tikkies_old_"+"b".repeat(48)
process.env.TIKKIES_API_KEY_SHA256=createHash("sha256").update(token).digest("hex")
process.env.TIKKIES_API_KEY_PREVIOUS_SHA256=createHash("sha256").update(previous).digest("hex")
process.env.TIKKIES_API_ENABLED="true"
let lookups=0, limited=false, broken=false, customer="c1", conflict=false
const db = {
 $queryRaw: async (_sql:unknown,global:string,subject:string)=>{if(broken)throw new Error("private-db-error");return [{key_hash:global,count:limited?9999999:1,reset_at:new Date(Date.now()+60000)},{key_hash:subject,count:1,reset_at:new Date(Date.now()+60000)}]}, $executeRaw:async()=>0,
 accounts:{findMany:async()=>{lookups++;if(broken)throw new Error("private-db-error");return customer?[{user_id:customer,provider:"google",provider_account_id:"g1"},...(conflict?[{user_id:"c2",provider:"discord",provider_account_id:"d2"}]:[])]:[]}},orders:{findMany:async()=>[]},point_redemptions:{findMany:async()=>[]},
 $transaction:async(fn:(db:unknown)=>unknown)=>fn(db),
}
const file=require.resolve("../lib/prisma");require.cache[file]={id:file,filename:file,loaded:true,exports:{prisma:db}} as NodeModule
const { POST }=require("../app/api/integrations/tikkies/entitlements/route")
const request=(auth=token,body:unknown={identities:[{provider:"google",providerAccountId:"g1"}]})=>new NextRequest("https://store.test/api/integrations/tikkies/entitlements",{method:"POST",headers:{"content-type":"application/json",...(auth?{authorization:`Bearer ${auth}`}:{})},body:JSON.stringify(body)})
async function check(){
 const logs:string[]=[];const original=console.info;console.info=(x:unknown)=>{logs.push(String(x))}
 try{
  for(const key of ["","wrong_"+"x".repeat(40)])assert.equal((await POST(request(key))).status,401)
  assert.equal(lookups,0,"Auth must precede customer lookup")
  assert.equal((await POST(request(token,{email:"customer@example.test"}))).status,400)
  assert.equal((await POST(request(token,{identities:[{provider:"google",providerAccountId:"x".repeat(9000)}]}))).status,400)
  const ok=await POST(request());assert.equal(ok.status,200);assert.equal(ok.headers.get("cache-control"),"no-store");assert.ok(ok.headers.get("x-request-id"));assert.deepEqual((await ok.json()).entitlements,[])
  assert.equal((await POST(request(previous))).status,200,"Previous rotation credential remains valid")
  customer="";assert.equal((await POST(request())).status,404);customer="c1"
  conflict=true;assert.equal((await POST(request())).status,409);conflict=false
  limited=true;const rate=await POST(request());assert.equal(rate.status,429);assert.ok(Number(rate.headers.get("retry-after"))>=1);limited=false
  broken=true;const down=await POST(request());assert.equal(down.status,503);assert.equal((await down.json()).error,"entitlements_unavailable");broken=false
  assert.equal(logs.some(l=>l.includes(token)||l.includes("g1")||l.includes("customer@example.test")||l.includes("private-db-error")),false)
  process.env.TIKKIES_API_ENABLED="false";assert.equal((await POST(request())).status,403);process.env.TIKKIES_API_ENABLED="true"
  assert.throws(()=>authenticateTikkies(new Request("http://unsafe.test",{headers:{authorization:`Bearer ${token}`}})))
 }finally{console.info=original}
 console.log("Tikkies route: auth/rotation, body limits, no-store, 404/409/429/503, HTTPS, and redacted logs OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})

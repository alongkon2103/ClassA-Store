// Run the actual CLI with a fake DB and official lookup; never touches customer data.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require=createRequire(import.meta.url)
const stub=(path:string,exports:unknown)=>{const file=require.resolve(path);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
const id="11111111-1111-4111-8111-111111111111"
let row:{id:string;whitelisted_username:string;roblox_user_id:string|null;roblox_resolved_for:string|null}={id,whitelisted_username:"PlayerName",roblox_user_id:null,roblox_resolved_for:null},writes=0,cas:{where:typeof row;data:{roblox_user_id:string;roblox_resolved_for:string}},lookup:{value:string;byId:boolean},resolved=true,concurrent=false,done:()=>void
stub("../lib/prisma",{prisma:{orders:{findMany:async()=>[row],updateMany:async(args:{where:typeof row;data:{roblox_user_id:string;roblox_resolved_for:string}})=>{writes++;cas=args;return {count:concurrent?0:1}}},$disconnect:async()=>{done()}}})
stub("../lib/integrations/tikkiesRoblox",{lookupTikkiesRoblox:async(value:string,byId:boolean)=>{lookup={value,byId};return resolved?{userId:"123",username:"RenamedPlayer",displayName:"Player"}:null}})
async function run(args:string[]){
 const old=process.argv,file=require.resolve("./backfill-tikkies-roblox")
 try{process.argv=[old[0],file,...args];delete require.cache[file];await new Promise<void>(resolve=>{done=resolve;require(file)})}finally{process.argv=old}
}
async function check(){
 const original=console.log;const logs:string[]=[];console.log=(value:unknown)=>{logs.push(String(value))}
 try{
  await run([]);assert.equal(writes,0);assert.ok(logs.some(x=>x.includes('"mode":"dry-run"')))
  await run(["--apply","--dry-run"]);assert.equal(writes,0,"Explicit dry-run overrides apply")
  await run(["--apply"]);assert.equal(writes,1);assert.equal(cas.where.whitelisted_username,"PlayerName");assert.equal(cas.where.roblox_user_id,null);assert.equal(cas.data.roblox_user_id,"123");assert.equal(cas.data.roblox_resolved_for,"playername")
  resolved=false;await run(["--apply"]);assert.equal(writes,1,"Unresolved accounts must never be guessed or written")
  resolved=true;row={...row,roblox_user_id:"123",roblox_resolved_for:"playername"};concurrent=true
  await run(["--apply","--refresh",`--order-id=${id}`]);assert.deepEqual(lookup,{value:"123",byId:true},"Rename refresh uses saved ID, never the old username")
  assert.ok(logs.some(x=>x.includes("skipped_concurrent_change")))
 }finally{console.log=original}
 console.log("Tikkies backfill CLI: dry-run default/override, stable by-ID refresh, unresolved fail closed and concurrent-edit CAS OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})

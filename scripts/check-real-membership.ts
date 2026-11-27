import assert from 'node:assert/strict'
import {freezeBundle,parseBundleSnapshot} from '../lib/bundles'
import {prepareBundleCheckout} from '../lib/bundleCheckout'

async function main(){
 const id='10000000-0000-4000-8000-000000000001',a='10000000-0000-4000-8000-000000000002',b='10000000-0000-4000-8000-000000000003',c='10000000-0000-4000-8000-000000000004'
 const product={id,type:'bundle',is_active:true,is_consignment:false,bundle_product_ids:[a,b],bundle_all_ac_games:true,bundle_includes_tikkies:true}
 const variant={id:'variant',product_id:id,is_active:true,variant_type:'normal',duration_type:'days',duration_days:30}
 const games=[a,b,c].map((id,index)=>({id,name_th:'เกม'+index,name_en:'Game '+index,type:'roblox_whitelist',is_active:true,is_consignment:false}))
 const db={products:{findMany:async({where}:{where:{id?:{in:string[]}}})=>where.id?games.filter(game=>where.id!.in.includes(game.id)):games}}
 const snapshot=await freezeBundle(db as never,product,variant)
 assert.equal((snapshot as {allAcGames?:boolean}).allAcGames,true,'Purchased all-games inclusion must be frozen')
 assert.deepEqual(snapshot.items.map(item=>item.productId),[a,b,c],'New current games need not be in the old curated IDs')
 assert.equal((parseBundleSnapshot(snapshot) as {allAcGames?:boolean}).allAcGames,true)
 assert.throws(()=>parseBundleSnapshot({...snapshot,allAcGames:'true'}))
 assert.equal((parseBundleSnapshot({...snapshot,allAcGames:undefined}) as {allAcGames?:boolean}).allAcGames,undefined,'Older fixed bundles must not gain future games')
 for(const role of [undefined,'forged'])await assert.rejects(()=>prepareBundleCheckout(db as never,product,variant,{username:'Player123',buyerRole:role} as never),/bundle_account_not_allowed/)
 for(const role of ['user','partnership','affiliate'])assert.ok(await prepareBundleCheckout(db as never,product,variant,{username:'Player123',buyerRole:role}))
 assert.ok(await prepareBundleCheckout(db as never,product,variant,{username:'Player123',buyerRole:'admin'} as never))
 assert.equal(await prepareBundleCheckout(db as never,{...product,type:'desktop_program'},variant,{username:'Player123'}),undefined)
 await assert.rejects(()=>freezeBundle({products:{findMany:async()=>[games[0],{...games[1],is_consignment:true}]}} as never,product,variant),/bundle_invalid_members/)
 console.log('PASS real membership: explicit frozen current/future AC games, backwards compatibility and server-trusted admin-only checkout')
}
main().catch(error=>{console.error(error);process.exitCode=1})

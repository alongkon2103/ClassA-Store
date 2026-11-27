import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {prisma} from '../lib/prisma'
import {validateGameDefaults,stableDefaultsJson} from '../lib/tikkiesGameDefaults'
import {validateGameIntegration} from '../lib/gameIntegration'
import {writeGameIntegration,gameMapCredentialHash} from '../lib/integrations/gameIntegrationStorage'
import {readAdminGameConnection} from '../lib/integrations/tikkiesGameDefaults'

async function main(){
 const data=JSON.parse(await fs.readFile(process.argv[2],'utf8')),folder=process.argv[3]
 const document=validateGameDefaults(data.document),integration=validateGameIntegration(data.integration)
 const revision=createHash('sha256').update(stableDefaultsJson(document)).digest('hex')
 assert.equal(integration.universeId,'10778802249');assert.deepEqual(integration.placeIds,['127000121986100'])
 assert.ok(gameMapCredentialHash(data.id))
 if(process.argv[4]==='--check'){
  assert.equal(document.effects.length,5);assert.equal(document.actions.length,1);assert.equal(document.actions[0].trigger.type,'chat')
  console.log(JSON.stringify({valid:true,productId:data.id,commands:document.effects.map(e=>e.responses[0].event),inactive:true}));return
 }
 const result=await prisma.$transaction(async tx=>{
  const sameName=await tx.products.findMany({where:{OR:[{slug:'ac-dance'},{name_en:{equals:'AC Dance',mode:'insensitive'}}]},select:{id:true,slug:true,is_active:true,type:true,roblox_universe_id:true,roblox_place_ids:true}})
  let created=false
  if(sameName.length){
   assert.equal(sameName.length,1);assert.equal(sameName[0].id,data.id);assert.equal(sameName[0].slug,'ac-dance');assert.equal(sameName[0].is_active,false)
   const saved=await tx.$queryRaw<{revision:string}[]>`SELECT revision FROM product_tikkies_defaults WHERE product_id=${data.id}::uuid`
   assert.equal(saved[0]?.revision,revision,'Existing draft was edited; do not overwrite it')
  }else{
   await tx.products.create({data:{id:data.id,slug:'ac-dance',name_th:'AC Dance',name_en:'AC Dance',description_th:'เตรียมระบบเชื่อมต่อ Tikkies API — ยังไม่เปิดจำหน่าย',description_en:'Tikkies API preparation — not available for purchase',price:0,is_active:false,is_featured:false,type:'roblox_whitelist',roblox_universe_id:integration.universeId,roblox_place_ids:integration.placeIds,is_consignment:false}})
   await writeGameIntegration(tx,data.id,integration)
   await tx.$executeRaw`INSERT INTO product_tikkies_defaults(product_id,config,revision,updated_at) VALUES(${data.id}::uuid,${JSON.stringify(document)}::jsonb,${revision},clock_timestamp())`
   created=true
  }
  const product=await tx.products.findUniqueOrThrow({where:{id:data.id},select:{id:true,is_active:true,bundle_product_ids:true,bundle_all_ac_games:true,bundle_includes_tikkies:true,product_variants:{select:{id:true}},orders:{select:{id:true}},user_whitelist_access:{select:{id:true}}}})
  assert.equal(product.is_active,false);assert.equal(product.bundle_all_ac_games,false);assert.equal(product.bundle_includes_tikkies,false);assert.equal(product.bundle_product_ids.length,0)
  assert.equal(product.product_variants.length,0);assert.equal(product.orders.length,0);assert.equal(product.user_whitelist_access.length,0)
  const bundles=await tx.products.findMany({where:{OR:[{bundle_all_ac_games:true},{bundle_includes_tikkies:true}]},select:{id:true,price:true,bundle_product_ids:true}})
  assert.ok(bundles.every(b=>!b.bundle_product_ids.includes(data.id)))
  return {created,productId:data.id,revision,commands:document.effects.map(e=>e.responses[0].event),bundleProducts:bundles.map(b=>({id:b.id,price:String(b.price),games:b.bundle_product_ids.length}))}
 },{isolationLevel:'Serializable',timeout:15000})
 const connection=await readAdminGameConnection(prisma,data.id,'https://aclassstore.com')
 assert.deepEqual(connection.commandInputs,{JoinDance:'robloxUsername'});assert.equal(connection.commands.length,5)
 await fs.writeFile(folder+'/dance-receiver.private.json',JSON.stringify(connection,null,2),{mode:0o600})
 await fs.writeFile(folder+'/product-result.json',JSON.stringify(result,null,2),{mode:0o600})
 console.log(JSON.stringify({...result,active:false,receiverConfigStored:true}))
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1}).finally(()=>prisma.$disconnect())

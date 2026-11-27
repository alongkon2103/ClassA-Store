import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {prisma} from '../lib/prisma'
import {validateGameDefaults,stableDefaultsJson} from '../lib/tikkiesGameDefaults'
import {readAdminGameConnection} from '../lib/integrations/tikkiesGameDefaults'

const id='9c8dc56f-1d10-49ce-bed6-bd2385a4281a'
const expected='54437db39c1cc0349fea22ed2fd9400643d406b50082a08fe9c6a37b7c873eea'
async function main(){
 const product=await prisma.products.findUniqueOrThrow({where:{id},select:{is_active:true,slug:true,product_variants:{select:{id:true}},orders:{select:{id:true}}}})
 assert.equal(product.is_active,false);assert.equal(product.slug,'ac-dance');assert.equal(product.product_variants.length,0);assert.equal(product.orders.length,0)
 const rows=await prisma.$queryRaw<{config:unknown,revision:string}[]>`SELECT config,revision FROM product_tikkies_defaults WHERE product_id=${id}::uuid`
 assert.equal(rows.length,1)
 const before=rows[0],document=validateGameDefaults(before.config)
 let changes=0
 for(const effect of document.effects)for(const response of effect.responses){
  if(response.type==='robloxEvent'&&response.event==='JoinDance'){
   assert.ok(response.input==='robloxUsername'||response.input==='chatText')
   response.input='chatText';changes++
  }
 }
 assert.equal(changes,1)
 const normalized=validateGameDefaults(document)
 assert.ok(normalized.actions.some(a=>a.trigger.type==='chat'&&a.trigger.keyword===''&&a.cooldownSec===0))
 const revision=createHash('sha256').update(stableDefaultsJson(normalized)).digest('hex')
 assert.ok(before.revision===expected||before.revision===revision,'Draft edited since preparation; refuse to overwrite')
 if(process.argv.includes('--check')){console.log(JSON.stringify({valid:true,gameId:id,revision,changed:before.revision!==revision}));return}
 if(before.revision!==revision){
  const changed=await prisma.$executeRaw`UPDATE product_tikkies_defaults SET previous_config=config,previous_revision=revision,config=${JSON.stringify(normalized)}::jsonb,revision=${revision},updated_at=clock_timestamp() WHERE product_id=${id}::uuid AND revision=${before.revision}`
  assert.equal(changed,1,'Draft changed during update')
 }
 const connection=await readAdminGameConnection(prisma,id,'https://aclassstore.com')
 assert.deepEqual(connection.commandInputs,{JoinDance:'chatText'})
 await fs.writeFile(process.argv[2]+'/dance-receiver.private.json',JSON.stringify(connection,null,2),{mode:0o600})
 const result={gameId:id,revision,previousRevision:before.revision,active:false,commandInputs:connection.commandInputs}
 await fs.writeFile(process.argv[2]+'/defaults-result.json',JSON.stringify(result,null,2),{mode:0o600})
 console.log(JSON.stringify(result))
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1}).finally(async()=>{await prisma.$disconnect();setImmediate(()=>process.exit(process.exitCode||0))})

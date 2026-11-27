import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {prisma} from '../lib/prisma'
import {validateGameDefaults,stableDefaultsJson} from '../lib/tikkiesGameDefaults'
const id='9c8dc56f-1d10-49ce-bed6-bd2385a4281a'
const mappings=[
 {id:'5655',gift:'Rose',event:'DanceAura1',name:'ออร่าเต้น'},
 {id:'9947',gift:'Friendship Necklace',event:'QueuePriority',name:'ลัดคิวเต้น'},
 {id:'5658',gift:'Perfume',event:'DanceAura2',name:'ออร่าเต้น LV.2'},
 {id:'5879',gift:'Doughnut',event:'QueuePriorityV2',name:'ลัดคิวเต้น V.2'},
]
async function main(){
 const rows=await prisma.$queryRaw<{config:unknown,revision:string}[]>`SELECT config,revision FROM product_tikkies_defaults WHERE product_id=${id}::uuid`
 assert.equal(rows.length,1);const before=rows[0],document=validateGameDefaults(before.config)
 await fs.writeFile(process.argv[2]+'/defaults-before-gift-bindings.private.json',JSON.stringify(before,null,2),{mode:0o600})
 for(const binding of mappings){
  const effects=document.effects.filter(effect=>effect.responses.some(response=>response.type==='robloxEvent'&&response.event===binding.event))
  assert.equal(effects.length,1,binding.event);const effect=effects[0]
  const existing=document.actions.find(a=>a.effectId===effect.id&&a.trigger.type==='gift'&&String(a.trigger.giftId)===binding.id)
  const action={id:existing?.id||'dance-gift-'+binding.id,effectId:effect.id,name:binding.name,enabled:true,cooldownSec:0,trigger:{type:'gift',giftId:binding.id,giftName:binding.gift,minDiamonds:0,minRepeat:0,repeatCombo:true,triggerThreshold:1,waitForCombo:false}}
  const conflicts=document.actions.filter(a=>a.trigger.type==='gift'&&String(a.trigger.giftId)===binding.id)
  assert.ok(conflicts.every(a=>a===existing),'An existing binding uses this gift for another action; refuse to overwrite')
  if(existing)document.actions[document.actions.indexOf(existing)]=action
  else document.actions.push(action)
 }
 const normalized=validateGameDefaults(document)
 assert.ok(normalized.actions.some(a=>a.trigger.type==='chat'&&a.trigger.keyword===''&&a.cooldownSec===0))
 const revision=createHash('sha256').update(stableDefaultsJson(normalized)).digest('hex')
 if(before.revision!==revision){
  const changed=await prisma.$executeRaw`UPDATE product_tikkies_defaults SET previous_config=config,previous_revision=revision,config=${JSON.stringify(normalized)}::jsonb,revision=${revision},updated_at=clock_timestamp() WHERE product_id=${id}::uuid AND revision=${before.revision}`
  assert.equal(changed,1,'Settings changed during save; retry using the new revision')
 }
 const result={gameId:id,revision,actions:normalized.actions.length,mappings,immediate:true,repeatPerGift:true,cooldownSec:0}
 await fs.writeFile(process.argv[2]+'/gift-bindings-result.json',JSON.stringify(result,null,2),{mode:0o600})
 await fs.writeFile(process.argv[2]+'/defaults-after-gift-bindings.json',JSON.stringify(normalized,null,2),{mode:0o600})
 console.log(JSON.stringify(result))
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect())

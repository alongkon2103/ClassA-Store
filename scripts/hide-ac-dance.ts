import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {prisma} from '../lib/prisma'
const id='9c8dc56f-1d10-49ce-bed6-bd2385a4281a'
async function main(){
 const before=await prisma.products.findUniqueOrThrow({where:{id}})
 assert.equal(before.slug,'ac-dance')
 const orders=await prisma.orders.count({where:{product_id:id}})
 const grants=await prisma.user_whitelist_access.count({where:{product_id:id}})
 await fs.writeFile(process.argv[2]+'/product-before-hide.private.json',JSON.stringify(before,null,2),{mode:0o600})
 await prisma.products.update({where:{id},data:{is_active:false}})
 assert.equal(await prisma.orders.count({where:{product_id:id}}),orders)
 assert.equal(await prisma.user_whitelist_access.count({where:{product_id:id}}),grants)
 const result={gameId:id,active:false,ordersPreserved:orders,grantsPreserved:grants}
 await fs.writeFile(process.argv[2]+'/hide-result.json',JSON.stringify(result,null,2),{mode:0o600})
 console.log(JSON.stringify(result))
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect())

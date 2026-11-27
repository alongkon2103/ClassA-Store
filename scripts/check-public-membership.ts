import assert from 'node:assert/strict'
import {currentBundleBuyerRole} from '../lib/bundleBuyer'
import {formatDisplayMoney} from '../lib/displayCurrency'
async function main(){
 let row:any={role:'user',nativeStatus:'ACTIVE'}
 const db:any={users:{findUnique:async()=>row}}
 for(const role of ['user','admin','partnership','affiliate']){row={role,nativeStatus:'ACTIVE'};assert.equal(await currentBundleBuyerRole(db,{id:'fixture',role:'user'}),role)}
 row=null;await assert.rejects(currentBundleBuyerRole(db,{id:'missing',role:'admin'}));
 row={role:'user',nativeStatus:'KICKED'};await assert.rejects(currentBundleBuyerRole(db,{id:'blocked',role:'admin'}));
 await assert.rejects(currentBundleBuyerRole(db,{}));
 assert.equal(formatDisplayMoney(619,'en',0.03),'$18.57');assert.equal(formatDisplayMoney(0,'en',0.03),'$0.00');
 assert.equal(formatDisplayMoney(619*1.06,'en',0.03),'$19.68');
 assert.match(formatDisplayMoney(619,'th',0.03),/619/);
 for(const invalid of [null,undefined,0,-1,NaN,Infinity]){assert.match(formatDisplayMoney(619,'en',invalid),/THB/);assert.ok(!formatDisplayMoney(619,'en',invalid).includes('$619'))}
 console.log('PASS public active buyers, current DB role, blocked/missing deny and display-only USD conversion/safe fallback')
}
main().catch(e=>{console.error(e);process.exitCode=1})

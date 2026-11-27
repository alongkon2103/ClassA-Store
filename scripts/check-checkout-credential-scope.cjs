'use strict';
require('tsx/cjs');
const assert=require('node:assert/strict'),{NextRequest}=require('next/server');
let session={user:{id:'11111111-1111-4111-8111-111111111111',provider:'tikkies-checkout',role:'user'}},issued=0;
function stub(name,exports){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports};}
stub('next-auth',{getServerSession:async()=>session});stub('../lib/auth',{authOptions:{}});stub('../lib/desktopAuth',{createAuthCode:async()=>{issued++;return 'fixture-code'}});
const {POST}=require('../app/api/desktop/authorize/route.ts');
const request=()=>new NextRequest('https://aclassstore.com/api/desktop/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({port:49123,challenge:'c'.repeat(43),state:'fixture-state'})});
async function main(){
 assert.equal((await POST(request())).status,403,'a 15-minute checkout session must not mint a long-lived desktop credential');assert.equal(issued,0);
 session={user:{id:session.user.id,provider:'google',role:'user'}};assert.equal((await POST(request())).status,200);assert.equal(issued,1,'ordinary OAuth login retains the existing desktop flow');
 console.log('PASS checkout scope: payment-only sessions cannot mint desktop credentials; normal OAuth consent remains available');
}
main().catch(e=>{console.error(e);process.exitCode=1});

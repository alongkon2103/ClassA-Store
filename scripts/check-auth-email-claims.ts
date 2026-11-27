import assert from 'node:assert/strict'
const primary='11111111-1111-4111-8111-111111111111',newId='22222222-2222-4222-8222-222222222222'
let linked=false,stored=false,failClaims=false,failDesktop=false,linkedOwner:string|null=null
let created:any[]=[],emailLookups:any[]=[],claims:any[]=[],accountWrites:any[]=[],profileUpdates:any[]=[],logs:any[]=[]
const db:any={
 accounts:{findUnique:async()=>linked?{user_id:primary}:null,upsert:async(args:any)=>{accountWrites.push(args);return{user_id:linkedOwner??args.create.user_id}}},
 users:{findUnique:async({where}:any)=>({id:where.id,email:'owner@example.com',role:'user'}),findFirst:async(args:any)=>{emailLookups.push(args);return stored?{id:primary}:null},create:async({data}:any)=>{created.push(data);return{...data,id:data.id??newId}},update:async(args:any)=>{profileUpdates.push(args);return{}}},
 desktop_whitelist_grants:{findMany:async()=>{if(failDesktop)throw{code:'P2021',message:'PII and SQL must not be logged'};return[]},deleteMany:async()=>({})},
 $executeRaw:async(strings:TemplateStringsArray,...values:any[])=>{claims.push(values);if(failClaims)throw{code:'P2024',message:'PII and SQL must not be logged'};return 1},
 $queryRaw:async(_strings:TemplateStringsArray,...values:any[])=>{emailLookups.push(values);return stored?[{id:primary}]:[]},
}
const file=require.resolve('../lib/prisma');require.cache[file]={id:file,filename:file,loaded:true,exports:{prisma:db}} as NodeModule
const {authOptions}=require('../lib/auth')
const originalError=console.error;console.error=(...args)=>logs.push(args)
const signIn=authOptions.callbacks.signIn
const user=(email:string|null='Owner@Example.com')=>({id:'provider-id',name:'Owner',email,image:null})
const account=(provider='discord')=>({provider,providerAccountId:'provider-subject'})
const reset=()=>{linked=false;stored=false;failClaims=false;failDesktop=false;linkedOwner=null;created=[];emailLookups=[];claims=[];accountWrites=[];profileUpdates=[];logs=[]}
async function main(){
 reset();stored=true;const verified=user();assert.equal(await signIn({user:verified,account:account(),profile:{email:' Owner@Example.com ',verified:true}}),true);assert.equal(verified.id,primary);assert.equal(claims.length,1);assert.ok(claims[0].includes('owner@example.com'))
 assert.equal(emailLookups[0][0],'owner@example.com')
 reset();const unverified=user();assert.equal(await signIn({user:unverified,account:account(),profile:{email:'owner@example.com',verified:false}}),true);assert.equal(emailLookups.length,0);assert.equal(created[0].email,null);assert.equal(claims.length,0,'Unverified email must not link or claim')
 reset();linked=true;const absent=user(null);assert.equal(await signIn({user:absent,account:account(),profile:{}}),true);assert.equal(absent.id,primary);assert.equal(created.length,0);assert.equal(claims.length,0,'Linked account can still sign in without email')
 reset();const mismatch=user('different@example.com');assert.equal(await signIn({user:mismatch,account:account(),profile:{email:'owner@example.com',verified:true}}),true);assert.equal(claims.length,0,'Mismatching normalized profile must not claim')
 reset();failClaims=true;assert.equal(await signIn({user:user(),account:account('google'),profile:{email:'owner@example.com',email_verified:true}}),true,'License claim failure does not block an otherwise valid login');assert.ok(logs.length);assert.ok(!JSON.stringify(logs).includes('PII and SQL'))
 reset();failDesktop=true;assert.equal(await signIn({user:user(),account:account(),profile:{email:'owner@example.com',verified:true}}),true,'Optional old desktop grant table failure must not block sign-in');assert.equal(claims.length,1,'Independent whitelist claim still runs');assert.ok(!JSON.stringify(logs).includes('PII and SQL'))
 reset();linked=true;const changed=user('new@example.com');assert.equal(await signIn({user:changed,account:account(),profile:{email:'new@example.com',verified:true}}),true);assert.equal(changed.id,primary,'Provider identity stays primary after email changes');assert.equal(emailLookups.length,0);assert.ok(claims[0].includes('new@example.com'))
 reset();assert.equal(await signIn({user:user(),account:account('google'),profile:{email:'owner@example.com',email_verified:true}}),true);assert.ok(claims[0].includes('owner@example.com'))
 reset();stored=true;linkedOwner=newId;const raced=user();assert.equal(await signIn({user:raced,account:account('google'),profile:{email:'owner@example.com',email_verified:true}}),true);assert.equal(raced.id,newId,'ordinary OAuth must resolve the actual provider owner when SSO binds it concurrently');assert.ok(profileUpdates.every(args=>args.where.id===newId),'a provider race must not update a different customer profile');assert.ok(claims[0].includes(newId),'email grants belong to the resolved provider owner');
 console.log('PASS auth email claims: verified Google/Discord, normalized identity, linked accounts, OAuth/SSO owner race, unverified/mismatched denial, independent grant failures and safe logging')
}
main().catch(error=>{originalError(error);process.exitCode=1}).finally(()=>{console.error=originalError})

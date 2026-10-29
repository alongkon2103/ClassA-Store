// Render the real reward dialog with fake verification responses; never spends points or contacts Roblox.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
const require = createRequire(import.meta.url)
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/th/account/redeem" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Element"]) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
const { createRoot } = require("react-dom/client")
const { NextIntlClientProvider } = require("next-intl")
const file=require.resolve("../i18n/routing")
require.cache[file]={id:file,filename:file,loaded:true,exports:{useRouter:()=>({refresh:()=>{}})}} as NodeModule
const Redeem=require("../app/[locale]/account/redeem/RedeemClient").default
const messages=require("../messages/th.json"),t=messages.Account
const reward={id:"reward",kind:"game_days",title_th:"เกมทดสอบ",title_en:"Test game",description_th:"",description_en:"",image_url:null,image_urls:[],cost:100,days:3,available:null,per_user_limit:null,mine:0,product:{id:"game",type:"roblox_whitelist",name_th:"เกมทดสอบ",name_en:"Test game"}}
const calls:string[]=[],pending:{resolve:(value:Response)=>void}[]=[]
globalThis.fetch=async(url)=>{calls.push(String(url));return new Promise<Response>(resolve=>pending.push({resolve}))}
const button=(label:string)=>{const el=[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent===label);assert.ok(el,label);return el}
const delay=()=>new Promise(r=>setTimeout(r,550))
const resolve=async(index:number,data:unknown)=>act(async()=>{pending[index].resolve(Response.json(data));await Promise.resolve()})
async function check(){
 const root=createRoot(document.getElementById("root")!)
 await act(async()=>root.render(React.createElement(NextIntlClientProvider,{locale:"th",messages,timeZone:"Asia/Bangkok"},React.createElement(Redeem,{active:true,balance:1000,rewards:[reward],history:[],ignHints:{game:"OriginalName"}}))))
 await act(async()=>button(t.redeem_btn).click())
 await act(delay)
 assert.equal(calls.length,1,"Opening a prefilled Roblox name automatically verifies it")
 await resolve(0,{ok:true,user:{id:123,username:"OriginalName",displayName:"Original Player",avatarUrl:"https://example.test/avatar.png"}})
 assert.ok(document.querySelector('[role="dialog"] img[src="https://example.test/avatar.png"]'),"Verified avatar is visible")
 assert.ok(document.querySelector('[role="dialog"]')!.textContent?.includes("@OriginalName"))
 const input=document.querySelector<HTMLInputElement>('[role="dialog"] input')!
 const type=async(value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new dom.window.Event("input",{bubbles:true}))})
 await type("SlowPlayer");assert.equal(document.querySelector('[role="dialog"] img'),null,"Editing immediately removes the previous player's avatar")
 await act(delay);await type("LatestPlayer");await act(delay)
 await resolve(2,{ok:true,user:{id:456,username:"LatestPlayer",displayName:"Latest",avatarUrl:null}})
 await resolve(1,{ok:true,user:{id:123,username:"SlowPlayer",displayName:"Stale",avatarUrl:"https://example.test/stale.png"}})
 assert.ok(document.querySelector('[role="dialog"]')!.textContent?.includes("@LatestPlayer"));assert.equal(document.querySelector('[role="dialog"] img'),null,"Stale response must never replace the latest player")
 await type("NoSuchPlayer");await act(delay);await resolve(3,{ok:false,reason:"not_found"})
 assert.ok(document.querySelector('[role="status"]')!.textContent?.includes(t.redeem_ign_bad))
 await type("OfflinePlayer");await act(delay);await resolve(4,{ok:false,reason:"network"})
 assert.ok(document.querySelector('[role="status"]')!.textContent?.includes(t.redeem_ign_unavailable),"Service outage differs from missing player")
 await type("");await act(delay);assert.equal(calls.length,5,"Empty name makes no request");assert.equal(button(t.redeem_confirm_btn).disabled,true)
 await act(async()=>root.unmount())
 assert.equal(calls.every(url=>url.startsWith("/api/roblox/verify?username=")),true,"UI check must not redeem any points")
 console.log("Reward Roblox dialog: automatic prefilled/debounced lookup, avatar, stale response/empty reset, fallback and distinct errors OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})

import type {NextRequest,NextResponse} from 'next/server'

/** Match NextAuth's numbered cookie convention without mixing browser identities. */
export function setWebsiteSessionCookie(req:NextRequest,response:NextResponse,token:string,maxAge:number){
 const name='__Secure-next-auth.session-token',options={httpOnly:true,secure:true,sameSite:'lax' as const,path:'/'}
 for(const cookie of req.cookies.getAll())if(cookie.name===name||/^__Secure-next-auth\.session-token\.\d+$/.test(cookie.name))response.cookies.set(cookie.name,'',{...options,maxAge:0})
 if(token.length<=3800){response.cookies.set(name,token,{...options,maxAge});return}
 response.cookies.set(name,'',{...options,maxAge:0})
 for(let offset=0,index=0;offset<token.length;offset+=3800,index++)response.cookies.set(name+'.'+index,token.slice(offset,offset+3800),{...options,maxAge})
}

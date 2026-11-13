// Browser-only Supabase Auth adapter. Never use service_role credentials here.
export function createCmsAuth({url,anonKey,fetchImpl=fetch,storage=globalThis.sessionStorage}) {
  if (!/^https:\/\/[^/]+/.test(url) || !anonKey) throw Error('Supabase configuration missing');
  const endpoint=url.replace(/\/$/,'')+'/auth/v1/';
  let session=null;
  async function authRequest(path,{method='GET',body,token}={}) {
    const response=await fetchImpl(endpoint+path,{method,headers:{apikey:anonKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw Error(data.msg||data.error_description||data.message||'Authentication failed');
    return data;
  }
  function persist(value){if(value?.expires_in&&!value.expires_at)value.expires_at=Math.floor(Date.now()/1000)+value.expires_in;session=value; if(value) storage?.setItem('rdn-session',JSON.stringify(value));else storage?.removeItem('rdn-session')}
  function restore(){try{const saved=JSON.parse(storage?.getItem('rdn-session')||'null');if(saved?.access_token&&saved?.refresh_token){session=saved;return true}}catch{}return false}
  async function login(email,password){const result=await authRequest('token?grant_type=password',{method:'POST',body:{email,password}});persist(result);return result.user}
  async function token(){if(!session)return null;if(Date.now()/1000 < (session.expires_at||0)-60)return session.access_token;
    try{const result=await authRequest('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});persist(result);return result.access_token}catch{persist(null);return null}}
  async function logout(){const access=await token();if(access)await authRequest('logout',{method:'POST',token:access}).catch(()=>{});persist(null)}
  return {restore,login,token,logout,hasSession:()=>!!session};
}

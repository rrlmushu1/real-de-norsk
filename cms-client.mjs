// Optional Supabase REST client; never store service-role keys in frontend code.
export function cmsClient({url,anonKey,getAccessToken=()=>null,fetchImpl=fetch}) {
  if (!/^https:\/\//.test(url)) throw Error('CMS requires HTTPS');
  const base=url.replace(/\/$/,'')+'/rest/v1/';
  async function request(path,{method='GET',body,auth=false,prefer}={}) {
    const token=auth ? await getAccessToken() : null;
    if(auth&&!token) throw Error('Administrator login required');
    const res=await fetchImpl(base+path,{method,headers:{apikey:anonKey,Authorization:'Bearer '+(token||anonKey),...(body?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!res.ok) throw Error('CMS request failed ('+res.status+')');
    return res.status===204?null:res.json();
  }
  return {
    publicPage:async(slug='home')=>(await request('cms_public_pages?slug=eq.'+encodeURIComponent(slug)+'&select=published'))[0]?.published??null,
    adminPage:async(slug='home')=>(await request('cms_pages?slug=eq.'+encodeURIComponent(slug)+'&select=*',{auth:true}))[0]??null,
    saveDraft:async(slug,draft,revision)=>{
      if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid revision');
      const rows=await request('cms_pages?slug=eq.'+encodeURIComponent(slug)+'&revision=eq.'+revision+'&select=revision',{method:'PATCH',auth:true,body:{draft,revision:revision+1,updated_at:new Date().toISOString()},prefer:'return=representation'});
      if(rows.length!==1)throw Error('Content changed elsewhere. Reload before editing.');
      return rows[0];
    },
    publish:async(slug,published,revision)=>{
      const rows=await request('cms_pages?slug=eq.'+encodeURIComponent(slug)+'&revision=eq.'+revision+'&select=revision',{method:'PATCH',auth:true,body:{published,published_at:new Date().toISOString(),revision:revision+1},prefer:'return=representation'});
      if(rows.length!==1)throw Error('Content changed elsewhere. Reload before publishing.');
      return rows[0];
    }
  };
}

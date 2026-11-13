const allowedKinds=new Set(['supplier','carrier']);
const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
export function validatePortalProfile(input){
 const kind=clean(input.kind,20),company=clean(input.company,150),contact=clean(input.contact,150),email=clean(input.email,254),phone=clean(input.phone,40),coverage=clean(input.coverage,500),description=clean(input.description,3000);
 if(!allowedKinds.has(kind))throw Error('Tipo de portal inválido');
 if(company.length<2||contact.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.replace(/\D/g,'').length<7)throw Error('Datos de contacto incompletos');
 return {kind,company,contact,email,phone,coverage,description};
}
export function validatePortalDocument(input){
 const category=clean(input.category,40),filename=clean(input.filename,200),path=clean(input.path,400);
 if(!['tax','insurance','permit','fleet','catalog','other'].includes(category))throw Error('Categoría inválida');
 if(!/^[\w.() -]{1,200}$/.test(filename)||!/^[-\w/]+\.[\w-]+$/.test(path)||path.includes('..'))throw Error('Archivo inválido');
 return {category,filename,path};
}
export function portalApi({url,anonKey,getAccessToken,fetchImpl=fetch}){
 if(!/^https:\/\/[^/]+/.test(url)||!anonKey||typeof getAccessToken!=='function')throw Error('Portal sin configuración');
 const base=url.replace(/\/$/,'');
 async function call(path,options={}){
  const token=await getAccessToken();if(!token)throw Error('Inicia sesión para acceder al portal');
  const res=await fetchImpl(base+'/rest/v1/'+path,{...options,headers:{apikey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
  if(!res.ok)throw Error('Error de portal ('+res.status+')');
  return res.status===204?null:res.json();
 }
 return {
  myProfiles:()=>call('partner_profiles?select=id,kind,company,contact,email,phone,coverage,description,status,created_at&order=created_at.desc'),
  createProfile:input=>call('partner_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(validatePortalProfile(input))}),
  myDocuments:profileId=>call('partner_documents?select=id,profile_id,category,filename,created_at&profile_id=eq.'+encodeURIComponent(profileId)),
  addDocument:(profileId,input)=>call('partner_documents',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({profile_id:profileId,...validatePortalDocument(input)})})
 };
}

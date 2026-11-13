const statuses={intake_requests:new Set(['new','reviewing','contacted','closed']),partner_profiles:new Set(['pending','reviewing','approved','rejected','suspended'])};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function adminApi({url,anonKey,getAccessToken,fetchImpl=fetch}){
 if(!/^https:\/\/[^/]+/.test(url)||!anonKey||typeof getAccessToken!=='function')throw Error('Configuración administrativa inválida');
 const base=url.replace(/\/$/,'');
 async function request(path,options={}){
  const token=await getAccessToken();if(!token)throw Error('Sesión administrativa requerida');
  const response=await fetchImpl(base+'/rest/v1/'+path,{...options,headers:{apikey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
  if(!response.ok)throw Error('Operación administrativa rechazada ('+response.status+')');
  if(response.status===204)return null;
  const body=await response.text();return body?JSON.parse(body):null;
 }
 function list(table,limit=50){if(!statuses[table])throw Error('Recurso inválido');if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Límite inválido');return request(table+'?select=*&order=created_at.desc&limit='+limit)}
 function update(table,id,status){if(!statuses[table]?.has(status)||!uuid.test(id))throw Error('Actualización inválida');return request(table+'?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status})})}
 return {requests:(limit)=>list('intake_requests',limit),partners:(limit)=>list('partner_profiles',limit),updateRequest:(id,status)=>update('intake_requests',id,status),updatePartner:(id,status)=>update('partner_profiles',id,status)};
}

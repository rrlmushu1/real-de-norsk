const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
export function validateRequest(input,kind){
  if(!['quote','supplier','carrier','contact'].includes(kind))throw Error('Tipo de solicitud inválido');
  const company=clean(input.empresa,150),email=clean(input.email,254),phone=clean(input.telefono,40);
  if(company.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.replace(/\D/g,'').length<7)throw Error('Revisa empresa, correo y teléfono');
  const details=clean(input.detalles,2000);
  if(['quote','contact'].includes(kind)&&!details)throw Error('Describe el servicio requerido');
  return {kind,company,email,phone,contact:clean(input.contacto,150),service:clean(input.servicio,120),origin:clean(input.origen,200),destination:clean(input.destino,200),coverage:clean(input.cobertura,300),details};
}
export async function submitRequest({url,anonKey,fetchImpl=fetch},data,{captchaToken}={}){
  if(!/^https:\/\/[^/]+/.test(url)||!anonKey)throw Error('Servicio de solicitudes no configurado');
  if(!captchaToken)throw Error('Completa la verificación antispam');
  const response=await fetchImpl(url.replace(/\/$/,'')+'/functions/v1/intake-email',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({request:data,captchaToken})});
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    if(result?.folio)throw Error('Solicitud registrada con folio '+result.folio+'. La notificación por correo está pendiente. No vuelvas a enviarla.');
    throw Error('No se pudo enviar la solicitud ('+response.status+')');
  }
  if(!result?.folio)throw Error('El servidor no confirmó el folio');
  return result.folio;
}

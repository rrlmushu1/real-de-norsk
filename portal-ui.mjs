import {portalApi,validatePortalProfile} from './portal.mjs';

const h=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el};
export function createPortalUI({config,auth,root}){
 if(!config?.url||!config?.anonKey||!auth||!root)throw Error('Portal no configurado');
 const api=portalApi({...config,getAccessToken:()=>auth.token()});
 const status=h('p','');status.setAttribute('role','status');
 const clear=()=>{root.replaceChildren();root.append(status);status.textContent=''};
 async function show(){clear();if(!auth.hasSession()){
  root.append(h('h2','Acceso de proveedores y transportistas'));
  const form=document.createElement('form');form.innerHTML='<label>Correo<input name="email" type="email" required autocomplete="username"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button type="submit">Entrar</button>';
  form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);try{await auth.login(f.get('email'),f.get('password'));await show()}catch(err){status.textContent=err.message}};
  root.append(form,h('p','El alta de cuentas requiere invitación administrativa.'));return;
 }
 root.append(h('h2','Mi portal'));const logout=h('button','Cerrar sesión');logout.onclick=async()=>{await auth.logout();await show()};root.append(logout);
 let profiles;try{profiles=await api.myProfiles()}catch(e){status.textContent='No se pudieron cargar los perfiles: '+e.message;return}
 for(const p of profiles){const section=document.createElement('section');section.append(h('h3',p.company),h('p',p.kind+' · '+p.status));
  const list=h('div','Cargando documentos...');section.append(list);root.append(section);
  try{const docs=await api.myDocuments(p.id);list.replaceChildren(...docs.map(d=>h('p',d.category+' · '+d.filename)));if(!docs.length)list.textContent='Sin documentos'}catch{list.textContent='No se pudieron consultar los documentos'}
  if(!['pending','reviewing'].includes(p.status))continue;
  const form=document.createElement('form');form.innerHTML='<label>Categoría<select name="category"><option value="tax">Fiscal</option><option value="insurance">Seguro</option><option value="permit">Permisos</option><option value="fleet">Flota</option><option value="catalog">Catálogo</option><option value="other">Otro</option></select></label><label>Archivo PDF o imagen<input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required></label><button type="submit">Subir documento</button>';
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const file=form.elements.file.files[0];if(!file||file.size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Archivo no permitido (máximo 10 MB)');const token=await auth.token();if(!token)throw Error('Sesión vencida');const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[file.type];const path=p.id+'/'+crypto.randomUUID()+'.'+ext;const response=await fetch(config.url.replace(/\/$/,'')+'/storage/v1/object/partner-documents/'+path,{method:'POST',headers:{apikey:config.anonKey,Authorization:'Bearer '+token,'Content-Type':file.type,'x-upsert':'false'},body:file});if(!response.ok)throw Error('No se pudo subir el archivo');try{await api.addDocument(p.id,{category:form.elements.category.value,filename:file.name.replace(/[^\w.() -]/g,'_').slice(0,200)||'documento',path})}catch(err){await fetch(config.url.replace(/\/$/,'')+'/storage/v1/object/partner-documents/'+path,{method:'DELETE',headers:{apikey:config.anonKey,Authorization:'Bearer '+token}}).catch(()=>{});throw err}await show();status.textContent='Documento registrado'}catch(err){status.textContent=err.message}finally{button.disabled=false}};
  section.append(form);
 }
 const create=document.createElement('form');create.innerHTML='<h3>Registrar empresa</h3><label>Tipo<select name="kind"><option value="carrier">Transportista</option><option value="supplier">Proveedor</option></select></label><label>Empresa<input name="company" required></label><label>Contacto<input name="contact" required></label><label>Correo<input name="email" type="email" required></label><label>Teléfono<input name="phone" required></label><label>Cobertura<input name="coverage"></label><label>Servicios<textarea name="description"></textarea></label><button type="submit">Registrar</button>';
 create.onsubmit=async e=>{e.preventDefault();const btn=create.querySelector('button');btn.disabled=true;try{await api.createProfile(validatePortalProfile(Object.fromEntries(new FormData(create))));await show();status.textContent='Registro enviado para revisión'}catch(err){status.textContent=err.message}finally{btn.disabled=false}};root.append(create);
 }
 return {show};
}

/**
 * Real de Norsk — motor de ruteo y programación, SIN DEPLOYMENT.
 * La llave SAKBE se inyecta SOLO en el servidor: INEGI_SAKBE_TOKEN.
 * No se almacena ni expone en el frontend.
 * API INEGI: https://www.inegi.org.mx/servicios/Ruteo/
 */
const ROOT = "https://gaia.inegi.org.mx/sakbe_v3.1";
export const CONFIG = Object.freeze({
  costoKm: 23.91, viaticoDiario: 250, posicionamientoMargen: 0.20,
  maxConduccion24hMin: 14 * 60, maxTramoMin: 5 * 60,
  pausaMin: 30, descansoContinuoMin: 8 * 60,
  // Se debe seleccionar el código vehicular SAKBE de la tabla oficial;
  // NO se asume que el código 1 represente un tractocamión de 5 ejes.
});
function number(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("Dato inválido: " + field);
  return n;
}
function positive(v, field) {
  const n = number(v, field);
  if (n <= 0) throw new Error("Dato requerido: " + field);
  return n;
}
export function createSakbe({token, fetchImpl = fetch, vehiculo}) {
  if (!token || typeof token !== "string") throw new Error("Falta INEGI_SAKBE_TOKEN");
  if (!Number.isInteger(vehiculo) || vehiculo < 1) throw new Error("Configurar código vehicular SAKBE verificado");
  async function post(method, data) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetchImpl(ROOT + "/" + method, {
        method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"},
        body: new URLSearchParams({...data, type:"json", key:token}),
        signal:controller.signal
      });
      if (!res.ok) throw new Error("SAKBE HTTP " + res.status);
      const json = await res.json();
      if (json.response && (json.response.succes === false || json.response.success === false)) {
        throw new Error("SAKBE: " + (json.response.message || "Error de consulta"));
      }
      return json.data ?? json;
    } finally { clearTimeout(timer); }
  }
  return {
    buscar: async (texto) => {
      if (!texto || texto.trim().length < 3) throw new Error("Destino incompleto");
      const data = await post("buscadestino", {buscar:texto.trim(),num:15});
      return Array.isArray(data) ? data : (data?.destinos ?? data?.resultados ?? []);
    },
    tramo: async (idInicio,idFin,modo="libre",ejesExtra=0) => {
      if (!["libre","cuota","optima"].includes(modo)) throw new Error("Modo de ruta inválido");
      const params={dest_i:idInicio,dest_f:idFin,v:vehiculo,e:ejesExtra};
      const [ruta,detalle]=await Promise.all([post(modo,params),post({libre:"detalle_l",cuota:"detalle_c",optima:"detalle_o"}[modo],params)]);
      const r=Array.isArray(ruta)?ruta[0]:ruta;
      if (!r || r.long_km == null || r.tiempo_min == null || r.costo_caseta == null) {
        throw new Error("SAKBE no devolvió distancia, tiempo y peaje completos");
      }
      const segmentos=Array.isArray(detalle)?detalle:(detalle?.detalle ?? []);
      return {modo,km:number(r.long_km,"kilómetros"),minutos:number(r.tiempo_min,"tiempo"),
        casetas:number(r.costo_caseta,"casetas"),advertencia:r.advertencia ?? null,
        segmentos, fuente:"INEGI SAKBE",validadoEnVivo:true};
    }
  };
}
/**
 * Tramos ordenados: primer tramo posicionamiento, siguientes tramos con carga.
 * Se consulta cada tramo de forma independiente para no omitir paradas.
 */
export async function calcularRuta(api, ids, modo="libre", ejesExtra=0) {
  if (!Array.isArray(ids) || ids.length < 3) throw new Error("Se requieren tracto, carga y destino");
  const tramos=[];
  for(let i=0;i<ids.length-1;i++){
    const t=await api.tramo(ids[i],ids[i+1],modo,ejesExtra);
    tramos.push({...t,tipo:i===0?"posicionamiento":"servicio",desde:ids[i],hasta:ids[i+1]});
  }
  return {tramos,km:tramos.reduce((a,t)=>a+t.km,0),
    minutos:tramos.reduce((a,t)=>a+t.minutos,0),
    casetas:tramos.reduce((a,t)=>a+t.casetas,0)};
}
/**
 * Planificación conservadora con pausas y descansos.
 * No garantiza cumplimiento NOM-087 para horarios históricos: requiere
 * bitácora previa del conductor, zona horaria y validación de restricciones.
 */
export function programar({salidaISO, tramos, operacionesMin=[], minutosConducidosPrevios24h=0}) {
  if (!salidaISO || Number.isNaN(Date.parse(salidaISO))) throw new Error("Fecha de salida ISO inválida");
  const previo=number(minutosConducidosPrevios24h,"conducción previa");
  if(previo>CONFIG.maxConduccion24hMin) throw new Error("Conducción previa excede límite");
  let t=Date.parse(salidaISO), consecutivo=0, en24h=previo;
  const eventos=[];
  const add=(tipo,min,detalle)=>{if(min<=0)return;const inicio=new Date(t).toISOString();t+=min*60000;eventos.push({tipo,inicio,fin:new Date(t).toISOString(),minutos:min,detalle});};
  for(let i=0;i<tramos.length;i++){
    let restante=number(tramos[i].minutos,"minutos de ruta");
    while(restante>0){
      if(en24h>=CONFIG.maxConduccion24hMin){
        add("descanso",CONFIG.descansoContinuoMin,"Descanso mínimo; validar ventana móvil de 24 h");
        en24h=0; consecutivo=0;
      }
      if(consecutivo>=CONFIG.maxTramoMin){add("pausa",CONFIG.pausaMin,"Pausa de conducción");consecutivo=0;}
      const bloque=Math.min(restante,CONFIG.maxTramoMin-consecutivo,CONFIG.maxConduccion24hMin-en24h);
      if(bloque<=0)continue;
      add("conduccion",bloque,tramos[i].tipo ?? "ruta");
      restante-=bloque;consecutivo+=bloque;en24h+=bloque;
    }
    if(operacionesMin[i]!=null)add("operacion",number(operacionesMin[i],"operación"),"Carga, descarga o espera");
  }
  const inicio=Date.parse(salidaISO), dias=Math.max(1,Math.ceil((t-inicio)/(24*60*60000)));
  return {inicio:salidaISO,fin:new Date(t).toISOString(),eventos,diasViaticos:dias,
    viaticos:dias*CONFIG.viaticoDiario,requiereRevisionNormativa:true};
}
export function calcularCostos({ruta,programacion,tarifaKm,otrosServicios=0,gastosGestion=0}) {
  const [pos,...carga]=ruta.tramos;
  if(!pos || !carga.length)throw new Error("Ruta incompleta");
  const kmCarga=carga.reduce((a,t)=>a+t.km,0);
  const peajes=ruta.casetas;
  const costoBase=ruta.km*CONFIG.costoKm;
  const costoPos=pos.km*CONFIG.costoKm;
  const cobroPos=costoPos*(1+CONFIG.posicionamientoMargen);
  const flete=kmCarga*positive(tarifaKm,"tarifa por km");
  const viaticos=programacion.viaticos;
  const adicionales=number(otrosServicios,"servicios")+number(gastosGestion,"gestión");
  const subtotal=flete+cobroPos+peajes+adicionales;
  const costoTotal=costoBase+peajes+viaticos+adicionales;
  return {kmPosicionamiento:pos.km,kmCarga,kmTotal:ruta.km,peajes,viaticos,
    cobroPosicionamiento:cobroPos,flete,subtotal,ivaEstimado:subtotal*.16,
    totalConIva:subtotal*1.16,costoTotalEstimado:costoTotal,
    utilidadAntesImpuestos:subtotal-costoTotal,
    advertencia:"Verificar si viáticos ya están incluidos en costo/km para evitar doble conteo; ISR y retenciones requieren cálculo fiscal separado."};
}

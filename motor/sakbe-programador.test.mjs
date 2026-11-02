import test from "node:test";
import assert from "node:assert/strict";
import {createSakbe,calcularRuta,programar,calcularCostos} from "./sakbe-programador.mjs";

test("POST SAKBE y secreto fuera de la URL",async()=>{
 const requests=[];
 const fetchImpl=async(url,opts)=>{
  requests.push({url,opts});
  return {ok:true,json:async()=>({response:{succes:true},data:url.endsWith("/detalle_l")?[]:{long_km:100,tiempo_min:120,costo_caseta:50}})};
 };
 const api=createSakbe({token:"TOKEN_DE_PRUEBA",vehiculo:1,fetchImpl});
 const t=await api.tramo(1,2);
 assert.equal(t.km,100);assert.equal(t.casetas,50);
 assert.equal(requests.length,2);
 assert.ok(requests.every(x=>x.opts.method==="POST"&&!x.url.includes("TOKEN_DE_PRUEBA")));
});
test("posicionamiento, viáticos y precio",async()=>{
 const api={tramo:async(a,b)=>({km:a===1?100:200,minutos:a===1?120:360,casetas:a===1?0:150,segmentos:[]})};
 const ruta=await calcularRuta(api,[1,2,3]);
 assert.equal(ruta.km,300);assert.equal(ruta.casetas,150);
 const plan=programar({salidaISO:"2026-11-02T12:00:00.000Z",tramos:ruta.tramos});
 assert.equal(plan.eventos.filter(e=>e.tipo==="pausa").length,1);
 const c=calcularCostos({ruta,programacion:plan,tarifaKm:41.90});
 assert.equal(c.kmPosicionamiento,100);assert.equal(c.kmCarga,200);
 assert.equal(c.cobroPosicionamiento,2869.2);
});
test("no inventar kilómetros ni casetas",async()=>{
 const api=createSakbe({token:"PRUEBA",vehiculo:1,fetchImpl:async()=>({ok:true,json:async()=>({data:{long_km:40,tiempo_min:30}})})});
 await assert.rejects(()=>api.tramo(1,2),/completos/);
});

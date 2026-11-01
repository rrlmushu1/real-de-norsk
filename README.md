# Real de Norsk Autotransporte

Aplicación para Cloudflare Workers. Interfaz y backend en `worker.js`.

## Publicación gratuita

Cloudflare Dashboard → Workers & Pages → Create → Import a repository → GitHub → `rrlmushu1/real-de-norsk`. Selecciona Workers (no Pages), rama `main`, y despliega.

Configura el secreto **INEGI_SAKBE_TOKEN** en Worker → Settings → Variables and Secrets → Add → Secret. No introduzcas la clave en GitHub ni en el navegador.

Abre la URL `.workers.dev` y confirma que `/api/status` muestre `configured:true`. Luego consulta una localidad y una ruta real. No se ha validado aún el formato de la respuesta oficial SAKBÉ, y el precio calculado es preliminar.

Las consultas de rutas libres y cuota son independientes. El posicionamiento se factura como kilometraje cargado. Mantenimiento $2.15 MXN/km, casetas 10%, recargos de peso >25 t con margen bruto 7.5%.

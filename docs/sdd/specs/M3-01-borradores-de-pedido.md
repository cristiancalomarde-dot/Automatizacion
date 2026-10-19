# M3-01 · Armar los borradores de pedido

**Depende de:** M2 (reservas con partes, producto y proveedores; cerrado 2026-10-19)

## 1. Qué queremos lograr
Para una reserva **recibida**, la app arma solos los borradores de los mails de pedido: **uno por
casilla de proveedor**, con las fechas, los servicios, los pax y los vuelos, en español y con un tono
**"buena onda pero profesional"**. Lo que no va por mail queda como **tarea** dentro de la reserva.
Todavía no se manda nada: esta pieza deja los borradores guardados y un documento con ejemplos
armados desde reservas reales para que el owner revise el tono.

## 2. Qué hay hoy
- **Reservas (M2):** `reserva` y `reserva_componente`. Cada parte tiene tipo (`paquete`,
  `tramo_bus`, `servicio`), producto, fechas, `producto_servicio_id`, `proveedor_id`, `es_tarea`
  (bus que emite HI Travel), `pick_up` y `texto_agencia`. La reserva tiene pax, pasajeros, vuelos,
  habitación, pedidos especiales, `hoteles_agencia` (lo que reserva la agencia), notas y
  `sin_traslado_de`.
- **Catálogo (M1 y M2-08):** `producto_servicio` (tipo de servicio, descripción, proveedores con
  prioridad, `reserva_manual` para Kupos, Plataforma10 y Transvip), `producto_servicio_noches`,
  `tour_servicio_ajuste` (cómo queda cada servicio dentro de un tour) y
  `proveedor.canal` (`mail` / `whatsapp`) con sus mails.
- **Avisos de llegada** (`src/lib/reservas/avisos-vuelo.ts`): saben qué traslado necesita vuelo y
  si falta.
- **Ejemplos de pedidos de hoy:** `Insumos/Mails/Pedido Proveedor - *.docx` (texto en
  `Insumos/Mails/texto/`). Están en español, con el asunto "Reserva <pasajero> x<pax>" y cada
  servicio con su fecha. El owner los encuentra un poco secos.
- La tabla `reserva_pedido` está descripta en `docs/arquitectura/modelo-de-datos.md`, pero todavía
  no existe en la base.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Un borrador por casilla de proveedor y por reserva.** Las partes que van al mismo mail (normalizado) van juntas en un pedido, en orden de fecha. Ejemplo: el hotel y el Paquete 105 a Cuenca del Plata, o varias filas de Cuenca, todas a reservas8@ | Test con una reserva OD010B (hotel El Pueblito + Pkt 105 x Foz): sale **un** borrador a reservas8@ con los dos servicios. Test con IGRE01 + IGRE02 de Journaway: un borrador a reservas8@ con los dos lados |
| 2 | **Tour compuesto:** cada paquete-componente pide sus servicios a sus propios proveedores, con las fechas reales del tour (usa `tour_servicio_ajuste` y las noches) | Test con un CHB31 o ARCH31 real del catálogo: un borrador por casilla, cada uno solo con sus servicios y con las fechas calculadas desde el inicio de la reserva. En el San Pedro Explorer, los geysers del Tatio van el día 3 |
| 3 | **Qué lleva cada servicio:** alojamiento con IN/OUT, noches, tipo de habitación y régimen si se sabe; excursión con fecha, idioma (inglés por defecto), regular o privado, y pick up si vino; traslado con fecha, vuelo y hora si están, o **"vuelo pendiente"** (en Iguazú, "bus o vuelo pendiente") | Tests por tipo de servicio contra un texto esperado. Un traslado sin vuelo dice "vuelo pendiente" y el borrador igual se arma |
| 4 | **Los pasajeros:** cantidad de pax y el pasajero principal. Si la agencia mandó datos (nacimiento, pasaporte, nacionalidad, teléfono), van solo en los pedidos que los necesitan (alojamiento y excursiones), nunca inventados | Test: con pasaportes en la reserva, el pedido del hotel los lleva. Sin datos, no aparece ningún "PAX 1:" vacío |
| 5 | **Asunto:** "Reserva <pasajero principal> x<pax> · <código del producto>", más el número de reserva de la agencia si existe | Test del asunto con y sin número |
| 6 | **Tono "buena onda pero profesional"** desde una plantilla en un solo archivo editable (`data/plantillas/pedido-proveedor.md` o similar): saludo cálido, pedido claro, agradecimiento y cierre cercano. La firma queda con un lugar para **el nombre de quien envía** seguido de la firma de HI Travel ("Hi Travel South America · On duty phone +54 9 11 5588-9443 · www.hitravel.com.ar · Instagram @hitravelargentina") | Test: cambiar la plantilla cambia el texto sin tocar código. El borrador deja el nombre como dato aparte: lo completa M3-03 con quien aprueba. **No debe pasar:** que un borrador salga sin el lugar del nombre |
| 7 | **No se pide lo que no corresponde:** lo que reserva la agencia (`hoteles_agencia`, "booked by us") no genera pedido. El lado del traslado marcado en `sin_traslado_de` no se pide en esa reserva | Test con el SPAP05 de Journaway: ningún pedido a Our Habitas, Tayka ni los hoteles de la agencia (los Tayka los pide UYUO01 a Imperio Inca) |
| 8 | **Tareas en vez de mails:** un bus que emite HI Travel (`es_tarea`), un servicio `reserva_manual` (Kupos, Plataforma10, Transvip) y un proveedor con canal `whatsapp` generan una **tarea** en la reserva: "emitir boleto: ruta, fecha" o "contactar por WhatsApp: proveedor, fechas, servicios". Nunca un mail | Test con ARCH31 (bus El Calafate – El Chaltén): queda una tarea "emitir boleto" y ningún borrador para ese tramo. Test con un proveedor WhatsApp: una tarea, cero borradores para él |
| 9 | **Proveedor sin mail:** el pedido queda armado pero marcado "falta el mail del proveedor"; los demás se arman igual | Test: un proveedor sin mail da un borrador "sin destinatario" con el motivo, y la reserva puede seguir |
| 10 | **Solo reservas en estado recibida** (las de prueba también, para poder probar). En "para revisión" no se arma nada hasta que se resuelva | Test: una reserva "para revisión" devuelve "Resolvé primero lo que está para revisión" y no guarda borradores |
| 11 | **Se guardan y se pueden volver a armar.** Los borradores quedan en la base (migración nueva: `reserva_pedido` con destinatario(s), proveedor(es), partes que cubre, asunto, cuerpo, estado `borrador`, y `reserva_tarea` o equivalente para las tareas). Volver a armar reemplaza los borradores que nadie editó y **no pisa** uno que una persona editó | Integración en la base de pruebas: armar dos veces no duplica. Un borrador editado sobrevive al rearmado |
| 12 | **Documento de ejemplos para el owner:** `docs/sdd/diagnosticos/M3-01-ejemplos-pedidos.md` con los borradores de 5 o 6 reservas reales de prueba de las 3 agencias: un hotel solo, Iguazú con Cuenca del Plata, un tour compuesto (CHB31 o ARCH31), un Journaway (SPAP05 y SPAP01 + SPAP03) y un caso con tareas. Datos sensibles de pasajeros enmascarados | Existe el archivo, en llano y sin rutas ni jerga. El owner lo usa para ajustar el tono |

## 5. Qué queda afuera
- La pantalla para ver y editar los borradores (M3-02) y el envío (M3-03).
- IA para redactar: no se usa (#3).
- Traducir los pedidos a otro idioma: todo va en español.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — los datos de los pasajeros van solo a los pedidos que los necesitan y el documento de
  ejemplos los enmascara.
- **#4** — esta pieza no manda nada: solo arma y guarda borradores.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter + tipos → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; el guard de `src/lib/entorno/base-de-pruebas.ts`
  falla si apunta a la real) → 3) recorrido: armar los borradores de reservas de prueba reales en la
  base de pruebas y generar el documento de ejemplos. No se avanza a una capa con la anterior en rojo.
- **Test primero.**
- **Dónde:** `src/lib/pedidos/` (agrupar por casilla, armar el texto, tareas, guardar), la
  plantilla en `data/plantillas/`, la migración `supabase/migrations/0018_pedidos.sql` (aplicada solo
  a la base de pruebas; la real la aplica el loop principal con OK del owner) y un script
  `npm run armar:pedidos -- --reserva <id>` o `--ejemplos` para el documento.
- **Función pura en el centro:** `armarPedidos(reserva, catalogo) → { pedidos, tareas, avisos }`, sin
  base ni red, fácil de testear. El guardado va aparte.
- **Datos del catálogo:** reusar las consultas existentes (`src/lib/catalogo/consultas.ts`,
  `cargarDependenciasReservas`) en lugar de duplicarlas.
- Actualizar `docs/arquitectura/modelo-de-datos.md` con las tablas nuevas.

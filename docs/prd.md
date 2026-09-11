# Reservas de Catálogo HI Travel — PRD

> **Este documento manda sobre el *qué*: qué construimos, en qué orden, y qué significa
> «terminado».** El *cómo* técnico vive en `docs/arquitectura/` (un documento por tema) y no se decide acá.
>
> **Última revisión:** 2026-09-11

---

## 1. Qué es Reservas de Catálogo HI Travel

**Reservas de Catálogo HI Travel es la herramienta interna que toma las reservas de productos de
catálogo que llegan por mail, detecta qué producto es, dispara los pedidos a los proveedores y
muestra a todo el equipo el estado de cada reserva en un solo lugar.**

- **Para quién:** el equipo de operaciones de HI Travel (empresa de 12 personas, operador
  receptivo con clientes —agencias de viaje— en Europa y operación en Brasil, Argentina, Uruguay,
  Chile y Bolivia). Hoy no hay sistema de admin ni de reservas.
- **Qué promete:** hoy cada reserva de catálogo se procesa entera a mano —leer el mail de la
  agencia, identificar el producto, buscar qué proveedores lo prestan, escribir los mails de
  pedido, y seguir el estado de memoria o en un Excel suelto. Después: la reserva entra sola, el
  producto se detecta, los mails a proveedores salen armados, y el estado de cada reserva está
  visible para todo el equipo.
- **Qué problema resuelve:** trabajo manual repetitivo y disperso, sin registro central del estado
  de las reservas. No escala con el equipo chico y se pierde información entre casillas de mail.

## 2. El MVP — un recorrido completo, no una lista de features

El MVP se acepta cuando **una reserva real recorre todo el circuito una vez**:

```
Llega un mail de reserva de una agencia piloto (1 de las 3 con más volumen)
  → la app lee el mail y extrae los datos clave (producto, fechas, pax, servicios)
  → empareja el producto contra la lista de catálogo; si no puede, lo marca para revisión humana
  → arma y envía el/los mail(s) al/los proveedor(es) de ese producto pidiendo fechas y servicios
  → la reserva aparece en la vista interna con estado «pedido a proveedor»
  → cuando el proveedor responde, una persona de HI Travel marca a mano el estado final
    (confirmado / con cambios / rechazado) y queda visible para todo el equipo
```

Si eso corre de punta a punta **una vez**, el MVP está probado.

**Volumen de referencia:** ~10-12 reservas de catálogo por semana. Cada producto tiene entre 1 y 4
proveedores. Se arranca con 1 a 3 formatos de agencia (los de más volumen).

## 3. Milestones (en orden)

### M1 — Catálogo y proveedores como datos del sistema

**Objetivo:** tener en el sistema la lista de productos de catálogo con sus proveedores, y el
directorio de proveedores con los datos de contacto para mandarles mail.
**Por qué primero:** sin esto no se puede ni detectar qué producto es una reserva ni saber a quién
escribirle. Todo lo demás lo llama.

**Está terminado cuando:**
- [ ] La lista de productos de catálogo está cargada en el sistema, cada uno con sus 1-4
      proveedores asociados (fuente: el Excel actual de productos).
- [ ] El directorio de proveedores está cargado con, como mínimo, nombre y mail de contacto por
      proveedor. *(Este listado hay que armarlo — hoy no existe consolidado.)*
- [ ] Dado un producto de catálogo, el sistema devuelve sus proveedores con sus mails.
- [ ] El catálogo representa tanto **productos simples** (un producto, sus servicios, sus
      proveedores) como **tours compuestos**: una secuencia ordenada de paquetes de catálogo y,
      a veces, tramos de bus público que HI Travel emite por fuera del sistema (ej. *Patagonia
      Highlights* = El Chaltén + bus + El Calafate + bus + Puerto Natales; *Overland San Pedro–
      Uyuni* = SPA Explorer + Overland Bolivia, sin tramos externos porque el traslado va
      incluido en el servicio del proveedor boliviano).

### M2 — Entrada de reservas por mail y detección del producto

**Objetivo:** que un mail de reserva de una agencia piloto entre al sistema convertido en una
reserva estructurada con el producto identificado.
**Por qué acá:** es la puerta de entrada del recorrido; sin la reserva adentro y el producto
detectado, no hay nada que mandarle a un proveedor.

**Está terminado cuando:**
- [ ] Un mail de una de las agencias piloto entra al sistema y queda registrado como una reserva.
- [ ] Si el mail es una respuesta dentro del mismo intercambio de una reserva ya existente (mismo
      booking_id de la agencia **y mismo producto** — ej. piden o mandan datos de vuelo/pasaporte),
      el sistema **no crea una reserva nueva**. Si el booking_id se repite pero el producto es
      distinto (un mismo cliente compra algo más después), **sí se crea** una reserva nueva — no
      alcanza con mirar el booking_id solo.
- [ ] Si el mail viene como PDF adjunto en vez de en el cuerpo (ej. TourRadar), el sistema lee el
      PDF igual que leería el cuerpo del mail.
- [ ] El sistema extrae los datos clave: producto, fechas, cantidad de pasajeros, **datos de
      vuelo (número, aerolínea, horario de llegada/salida) cuando el producto incluye un
      traslado** — sin eso no se le puede pedir el traslado a un proveedor —, y servicios
      pedidos.
- [ ] El sistema empareja el producto contra el catálogo de M1. Si no logra emparejarlo con
      confianza, la reserva queda marcada «para revisión» en vez de adivinar.
- [ ] Si el producto incluye un traslado y el mail no trae datos de vuelo, la reserva también
      queda «para revisión» hasta que se completen.
- [ ] Si el producto es un **tour compuesto**, el sistema identifica cada componente (qué paquete,
      qué tramo de bus) por separado.
- [ ] La reserva queda con un estado inicial visible (ej. «recibida» / «para revisión»).

### M3 — Pedido automático a los proveedores

**Objetivo:** que, con la reserva y el producto ya detectados, salgan los mails a los proveedores
con las fechas y servicios específicos.
**Por qué acá:** es la acción que ahorra el trabajo manual; necesita M1 (a quién) y M2 (qué pedir).

**Está terminado cuando:**
- [ ] Para una reserva con producto detectado, el sistema arma un mail por cada proveedor de ese
      producto, con las fechas y los servicios pedidos.
- [ ] Para un **tour compuesto**, se arma un pedido por cada paquete-componente, a sus propios
      proveedores. Los **tramos de bus público externos** (los que HI Travel emite en su propio
      sistema de emisión, no el bus incluido en el servicio de un proveedor) **no generan mail a
      nadie**: quedan como una tarea pendiente dentro de la reserva ("emitir boleto: ruta, fecha")
      para que una persona lo haga en su sistema de siempre. La app nunca intenta emitir ni
      reservar el bus.
- [ ] Si un proveedor de la reserva **solo se contacta por WhatsApp** (no por mail), su pedido
      tampoco se envía solo: queda como la misma clase de tarea pendiente dentro de la reserva
      ("contactar por WhatsApp: proveedor, fechas, servicios"). El MVP solo automatiza el canal
      mail; WhatsApp a proveedores sigue siendo trabajo manual, igual que los tramos de bus.
- [ ] Los mails se envían a los proveedores. *(Si salen automáticos o con aprobación humana previa
      lo decide `/arquitectura` — efecto externo, regla #4 de la constitución.)*
- [ ] La reserva pasa a estado «pedido a proveedor» y queda registrado a qué proveedores se
      escribió y cuándo.

### M4 — Vista interna de reservas y su estado

**Objetivo:** una pantalla donde el equipo ve todas las reservas recibidas y su estado, y puede
actualizarlo a mano.
**Por qué al final:** es el resultado visible del MVP y el lugar de trabajo diario; consume lo que
producen M2 y M3.

**Está terminado cuando:**
- [ ] Una pantalla lista las reservas con: agencia, producto, fechas, pasajeros, proveedores
      contactados y estado actual.
- [ ] Una reserva de **tour compuesto** muestra cada componente (paquete o tramo de bus) con su
      propio estado, además del estado general de la reserva.
- [ ] Una persona puede cambiar el estado de una reserva (o de un componente) a mano (ej.
      confirmado / con cambios / rechazado / cerrado / boleto emitido) y el cambio se guarda.
- [ ] El estado actualizado lo ve todo el equipo (no queda en la máquina de quien lo cambió).
- [ ] El recorrido completo del §2 se puede ver corriendo con una reserva real — al menos una vez
      con un producto simple y una vez con un tour compuesto.

## 4. Riesgos, con su límite aceptado

| # | Riesgo | Hasta dónde se tolera / qué se hace al cruzarlo |
|---|---|---|
| 1 | El emparejado producto↔catálogo falla o empareja mal. | Se tolera corrección manual. Si más del 20% de las reservas de las agencias piloto necesitan corregir el producto a mano, se frena y se ajusta el emparejado antes de sumar más formatos. |
| 2 | Un mail mal leído dispara un pedido equivocado a un proveedor. | En el MVP los mails a proveedores se revisan/aprueban antes de salir (regla #4) hasta que el equipo confíe en la extracción. |
| 3 | El directorio de proveedores no está listo a tiempo. | M1 no se cierra sin el directorio cargado con nombre y mail. Si al empezar M3 faltan contactos, se completan antes de seguir; no se avanza con huecos. |
| 4 | El Make semi-armado y el MVP borrador ya existentes condicionan el diseño. | Se revisan una sola vez en `/arquitectura`. Si no sirven como base, se descartan sin intentar rescatarlos. |
| 5 | Una agencia piloto cambia su formato de mail. | Se trata como bug: se ajusta la lectura de esa agencia. No frena el resto. |
| 6 | Los tours compuestos (paquetes encadenados + tramos de bus) resultan más difíciles de catalogar de lo esperado. | Se cargan primero los top-sellers (de memoria del owner, sin auditar contra ventas reales): **CHB31** Overland San Pedro de Atacama→Uyuni→La Paz, **BOCHI04R** el mismo en reversa (La Paz→San Pedro, con transfer final a CJC), **ARCH31** Patagonia Highlights, **ARCH33** Patagonia Trekking Paradise (W Trek), **5C01** 5 Countries Rio de Janeiro→La Paz, **BRARCH26** Rio de Janeiro→Santiago, **AR09** Patagonia Adventure Tour. Si toma mucho más tiempo que un producto simple, se ajusta el modelo antes de cargar el resto. |

## 5. Fuera de alcance

Lo de abajo **no se construye en el MVP**:

- **Viajes a medida** — solo productos de catálogo.
- **Módulo de costos, márgenes y administración** — es el paso siguiente, no el MVP.
- **Lectura automática de las respuestas de los proveedores** — las lee y carga una persona.
- **Respuesta automática a la agencia cliente** — la confirmación/rechazo a la agencia la sigue
  mandando una persona por fuera.
- **Emitir o gestionar boletos de bus desde la app** — la emisión de los tramos de bus público
  sigue haciéndose en el sistema de emisión existente; la app solo la marca como pendiente.
- **Productos y mails de Journaway** — formato propio (alemán mezclado con inglés), códigos de
  producto distintos, catálogo separado de solo 6-7 productos (varios son excursiones de un día).
  Se suman en un milestone posterior, una vez validado el circuito con los formatos estándar
  (Kilroy/Jysk, TourRadar). Detectarlos será por remitente **y** por código de producto, ambos
  distintos a los habituales.
- **Más de 3 formatos de agencia estándar** — se suman después, con el circuito ya funcionando.
- **Reservas que llegan de la agencia por otro canal** que no sea mail (teléfono, WhatsApp,
  portal).
- **Pedidos a proveedores por WhatsApp** — el MVP solo automatiza el canal mail. Un proveedor que
  solo se contacta por WhatsApp queda como tarea manual pendiente (ver M3), no se le escribe desde
  la app.
- **Integración con Asana** (crear tareas para que la supervisora asigne casos entre operativos) —
  candidato claro para un milestone posterior al MVP, una vez que el circuito de reservas esté
  probado. El MVP tiene un solo rol sin asignación de casos (ver `auth-y-permisos.md`); agregar
  Asana antes complicaría dos cosas a la vez.
- **Facturación, pagos, vouchers y documentación al pasajero.**

## 6. Preguntas abiertas

1. ~~¿Los mails a proveedores salen automáticos o con aprobación humana previa?~~ — **resuelto en
   `/arquitectura`: aprobación humana, una por reserva.** Ver
   [`docs/arquitectura/integraciones.md`](arquitectura/integraciones.md).
2. ~~¿El emparejado de producto lo hace una regla simple (código/nombre) o un modelo de IA?~~ —
   **resuelto: código primero contra la tabla de códigos; la IA entra solo como respaldo.** Ver
   [`docs/arquitectura/integraciones-ia.md`](arquitectura/integraciones-ia.md).
3. ~~¿Desde qué casilla de mail entra y con qué credenciales / permisos?~~ — **resuelto por
   completo:** es el Gmail existente al que Ferozo ya reenvía automáticamente lo que llega a
   `sales@hitravel.com.ar`, vía Gmail API. Costo US$ 0. Confirmado (2026-09-11): el reenvío es
   una regla del servidor de Ferozo, funciona 24/7.
4. ~~¿Qué se hace si una reserva de agencia piloto es en realidad un paquete/tour combinado?~~ —
   **resuelto (2026-09-11): entran al alcance del MVP como "tours compuestos"** (secuencia de
   paquetes + a veces tramos de bus externo). Ver §2, M1-M4 y
   [`DECISIONS.md`](../DECISIONS.md).
5. **Los estados exactos del ciclo de vida de una reserva** — *sigue abierta; hay una propuesta de
   8 estados en [`user-flow.md`](arquitectura/user-flow.md) §3, se valida y afina en M4. Con tours
   compuestos, además hay que afinar el estado por componente (§3 M4).*
6. **El armado exacto del Overland San Pedro–Uyuni y de otros tours compuestos** — el owner lo
   describió en la conversación (ver `DECISIONS.md`), pero se confirma con el detalle real al
   cargar el catálogo en M1.
7. **Cómo se manda un mail "como" `operations@hitravel.com.ar`** (SMTP de Ferozo vs. servicio
   transaccional tipo Resend) — *no bloquea M1; se resuelve antes de M3, a confirmar con quien
   administra el dominio.* Ver [`integraciones.md`](arquitectura/integraciones.md) "Abierto".

## 7. El cómo técnico (lo completa `/arquitectura`)

- **Stack, deploy y costo:** [`docs/arquitectura/stack.md`](arquitectura/stack.md) — Next.js + Vercel + Supabase; costo ~US$ 1-57/mes (estimación gruesa; `/costo` da la fina)
- **Modelo de datos:** [`docs/arquitectura/modelo-de-datos.md`](arquitectura/modelo-de-datos.md) — datos compartidos por todo el equipo; #1 no aplica en sentido estricto
- **Secretos:** [`docs/arquitectura/secretos.md`](arquitectura/secretos.md) — #2
- **Recorrido del usuario:** [`docs/arquitectura/user-flow.md`](arquitectura/user-flow.md)
- **Marca:** [`docs/arquitectura/marca.md`](arquitectura/marca.md)
- **Integraciones IA:** [`docs/arquitectura/integraciones-ia.md`](arquitectura/integraciones-ia.md) — Claude Sonnet 5 lee los mails; #3, techo US$ 20/mes
- **Otros sistemas:** [`docs/arquitectura/integraciones.md`](arquitectura/integraciones.md) — Gmail (lectura de casilla + envío a proveedores); #4, aprobación por reserva
- **Auth y permisos:** [`docs/arquitectura/auth-y-permisos.md`](arquitectura/auth-y-permisos.md) — login con Google restringido al dominio, rol único "operador"

## 8. La regla de gestión

> **El alcance se achica quitando features (que quedan visibles en §5), nunca bajando la vara de
> «terminado».** Un milestone con condiciones recortadas parece cerrado y no lo está: la deuda
> queda escondida en un checkbox tildado.

Si algo se posterga, se anota con milestone destino y dueño, y el porqué va a
[`DECISIONS.md`](../DECISIONS.md). Lo que toque la regla #1 de la
[constitución](sdd/constitucion.md) (datos de usuarios) no se posterga nunca.

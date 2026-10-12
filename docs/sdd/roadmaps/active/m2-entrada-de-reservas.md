# M2 — Entrada de reservas por mail y detección del producto — plan

## 1. Qué logramos con este milestone

Que un mail de reserva de Kilroy, TourRadar o Journaway entre solo al sistema y quede como una
reserva con:
- su producto reconocido en el catálogo de M1, y los componentes si es un tour;
- fechas, pasajeros y vuelos;
- un estado visible: "recibida", o "para revisión" con el motivo.

Al terminar, el owner ve en la app las reservas que llegaron a `sales@` sin haber cargado nada a
mano. Ver `docs/prd.md` M2.

## 2. Qué queda afuera

- **Mandar mails a proveedores:** es M3. M2 no escribe a nadie.
- **La bandeja completa** (filtros, tablero, cambiar estados, editar datos, resolver revisiones):
  es M4. M2 entrega una lista y un detalle de solo lectura, para ver qué entró y por qué quedó
  en revisión.
- **Leer las respuestas de los proveedores y responderle a la agencia:** fuera del MVP (`prd.md`
  §5).
- **Más agencias que Kilroy (con Jysk, el mismo formato), TourRadar y Journaway.**
- **Avisos por mail o Slack cuando entra una reserva:** se evalúa después de usarlo.
- **Cargar el resto del catálogo de Kilroy y TourRadar (los ~100 tours):** se suma de a tandas en
  paralelo. Si llega una reserva de un producto que no está cargado, queda "para revisión" con
  ese motivo.

## 3. Preguntas y riesgos

**Respondidas antes de planear (owner, 2026-10-11):**
- **De dónde se leen los mails:** directo de `sales@` en Ferozo por IMAP, revisando también la
  carpeta Spam. Así ninguna reserva se pierde por el antispam. Ver `DECISIONS.md`.
- **Agencias:** Kilroy + TourRadar + Journaway. Journaway entra con las últimas piezas. Ver
  `DECISIONS.md`; el PRD §5 quedó actualizado.
- **Arranque:** primero un **modo prueba** sobre los mails de ejemplo y unos reales elegidos, con
  revisión del owner. Recién con su OK se activa la lectura automática.
- **Journaway:**
  - Su catálogo está en `Insumos/Borrador productos Journaway.xlsx`, completado por el owner: los
    códigos van sin guion y lo que se usa está en celeste.
  - SPAP05 y SPAP06 se reconocen por los hoteles Tayka o por el título ("San Pedro de Atacama +
    Uyuni Salt Flats in Tayka Hotels 7N/8D" u "8N/9D").
  - Los Tayka son parte del Overland y los reserva Imperio Inca.
  - Plataforma10 es el sistema donde HI Travel emite los pasajes a mano: queda como tarea, no
    como mail.

**Tareas del owner (no bloquean el plan; sí la pieza que las usa):**
- **Crear la clave de Claude** (`ANTHROPIC_API_KEY`) y cargarla. Hace falta desde M2-02.
- **Pasar la clave de `sales@`** para cargarla como variable de entorno. Hace falta desde M2-07.
- **Pedirle a Journaway** que mande a `sales@` (con copia a quien quiera) y que ponga el código
  HI Travel. Mientras tanto, se puede agregar en Ferozo un reenvío automático de operaciones3@ a
  sales@.
- **Copiar el Excel de proveedores actualizado** (con Patagonia Profunda) a `Insumos/`.

**Abiertas, no bloquean:**
- ~~Cada cuánto se lee la casilla~~ — **resuelto (owner, 2026-10-11): una vez por día, a las 12 del
  mediodía (hora Argentina).** Las reservas llegan mayormente desde Europa y con mucha
  anticipación, así que no hace falta leer cada 5 minutos. Alcanza con el cron diario del plan
  Hobby de Vercel. Si hiciera falta más seguido, se revisa.
- **El modelo de IA** (Sonnet vs. Opus): se decide con la precisión medida en el modo prueba.

**Riesgos y su límite aceptado:**
- **La IA lee mal (PRD riesgo #1).** El modo prueba mide cuánto hay que corregir. Si más del 20%
  necesita corrección manual, se frena y se ajusta antes de activar la lectura automática.
- **Hay productos que no están cargados:** la reserva queda "para revisión" con el motivo
  "producto no está en el catálogo". Nunca se adivina.
- **La casilla de Ferozo está casi llena:** si se llena, los mails rebotan antes de llegar. La
  app no lo puede evitar; el owner libera espacio o amplía el plan.
- **Leer `sales@` incluye mucho mail que no es reserva:** se filtra por remitente o agencia
  conocida antes de gastar IA (#3). Lo que no es de una agencia piloto no se procesa.

## 4. Reglas del proyecto que toca este milestone

- **#1** — tablas nuevas (`reserva`, `evento_reserva`, `mail_recibido`…) con RLS activa y autoría
  en el historial.
- **#2** — la clave de `sales@` y la de Anthropic van en variables de entorno, nunca en el código.
- **#3** — cada lectura de mail con IA pasa por el techo de gasto de `uso_ia`, con tope por mail.
- **#4** — no aplica a leer, pero M2 no puede tener ningún camino que mande mails ni que
  modifique la casilla (no se marca, mueve ni borra nada).
- **#5** — las 3 verificaciones en cada pieza.

## 5. Las piezas de trabajo (ESTA TABLA ES EL ESTADO)

| ID | Pieza | Estado | Depende de | Ficha |
|---|---|---|---|---|
| M2-01 | **Reservas en la base.** Tablas `reserva`, `reserva_componente`, `evento_reserva` y `mail_recibido` (migración con RLS). Agencias y remitentes conocidos en `data/agencias.csv`: Kilroy/Jysk, TourRadar y Journaway, con operations@ y de@journaway.com | ⬜ pendiente | — | `docs/sdd/specs/M2-01-reservas-en-la-base.md` |
| M2-02 | **Leer un mail con IA.** Un mail (cuerpo, o el PDF adjunto si hay) pasa a datos ordenados: agencia, booking_id, producto o tours nombrados, fechas, pax, pasajeros, vuelos y pedidos especiales, con confianza por campo. Funciona con mails en alemán. Bajo el techo de gasto | ⬜ pendiente | M2-01 | `docs/sdd/specs/M2-02-leer-mail-con-ia.md` |
| M2-03 | **Reconocer el producto (Kilroy y TourRadar).** Código exacto → nombre de la agencia (`codigo_externo`) → propuesta de la IA con confianza. Tour compuesto con sus componentes. Va a "para revisión" si: no hay confianza, el producto no está cargado, o falta el vuelo y el producto tiene traslado | ⬜ pendiente | M2-02 | `docs/sdd/specs/M2-03-reconocer-el-producto.md` |
| M2-04 | **Mismo intercambio, no reserva nueva.** Mismo booking_id + mismo producto → se agrega al historial de la reserva existente (por ejemplo, cuando mandan los vuelos). Producto distinto → reserva nueva. Ambiguo → "para revisión". Además, la marca de "posible duplicada" | ⬜ pendiente | M2-03 | `docs/sdd/specs/M2-04-mismo-intercambio.md` |
| M2-05 | **Ver las reservas que entraron.** Lista y detalle de solo lectura: agencia, producto, fechas, pax, vuelos, estado y motivo de revisión, más el mail original. Es la base de la bandeja de M4 | ⬜ pendiente | M2-03 | `docs/sdd/specs/M2-05-ver-las-reservas.md` |
| M2-06 | **Modo prueba con mails reales.** Procesa los mails de `Insumos/Mails` (.docx, .pdf y .eml) por el circuito completo, con las reservas marcadas "de prueba". Entrega un reporte por mail para el owner (qué entendió y qué no) y mide el % que necesita corrección | ⬜ pendiente | M2-04, M2-05 | `docs/sdd/specs/M2-06-modo-prueba.md` |
| M2-07 | **Lectura automática de sales@.** Por IMAP en Ferozo, Inbox y Spam, **una vez por día a las 12 (hora Argentina)**. Solo los remitentes de las agencias. No marca, mueve ni borra nada, y no reprocesa. Se activa con el OK del owner sobre el modo prueba | ⬜ pendiente | M2-06 | `docs/sdd/specs/M2-07-lectura-automatica.md` |
| M2-08 | **Catálogo de Journaway.** Carga la planilla completada por el owner: productos simples, paquetes SPAP como combinaciones de excursiones, SPAP05 y SPAP06 con el Overland de Imperio Inca, y los nombres de Journaway como `codigo_externo`. Recarga el directorio (Patagonia Profunda) | ⬜ pendiente | M2-01 | `docs/sdd/specs/M2-08-catalogo-journaway.md` |
| M2-09 | **Reservas de Journaway.** Reconoce el paquete a partir de la lista de tours sueltos con fecha, los hoteles Tayka o el título. Lee los vuelos en alemán. Separa los hoteles que reserva Journaway ("booked by us") de lo que pide a HI Travel. Pasa por el modo prueba con los mails de ejemplo | ⬜ pendiente | M2-06, M2-08 | `docs/sdd/specs/M2-09-reservas-journaway.md` |

**Cobertura de las condiciones de M2 en el PRD:**
- Un mail entra y queda como reserva: M2-01, M2-02, M2-07.
- No duplicar el mismo intercambio: M2-04.
- PDF de TourRadar: M2-02.
- Datos clave y vuelos: M2-02.
- Emparejar contra el catálogo, o "para revisión": M2-03 y M2-09.
- Traslado sin vuelo → "para revisión": M2-03.
- Componentes del tour compuesto: M2-03 y M2-09.
- Estado inicial visible: M2-05.

## 6. Cuándo está terminado el milestone
- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones del milestone en `docs/prd.md` se cumplen y se pueden demostrar.
- [ ] **El owner lo probó con sus ojos:** entra una reserva real de cada agencia a `sales@` y la
      ve en la app con su producto, o en "para revisión" con un motivo que entiende.
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.

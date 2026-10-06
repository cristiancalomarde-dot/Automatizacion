# M1 — Catálogo y proveedores como datos del sistema — plan

## 1. Qué logramos con este milestone

Que la app exista (con login) y tenga, cargados de tus Excel, el catálogo de productos —simples y
tours compuestos— con sus servicios y proveedores, y el directorio de proveedores con sus mails.
Al terminar, alguien entra a la app, busca un producto (ej. el Overland CHB31) y ve a qué
proveedores y con qué mail se le pediría cada parte. Es la base sin la cual M2 y M3 no tienen a
quién escribirle. Ver `docs/prd.md` M1.

## 2. Qué queda afuera

- **Ingesta de mails, emparejado automático de reservas, envío de pedidos** — eso es M2/M3.
- **Pantalla de subir el Excel** — para esta primera carga, el equipo de construcción corre la
  importación directo con los archivos que ya diste en `Insumos/`. Una pantalla de "resubir el
  Excel cuando lo actualices" queda para un milestone posterior (no bloquea M1; el dato ya
  cargado sirve para probar M2 igual).
- **Todo el catálogo completo (2218 filas del Excel de paquetes)** — M1 carga el directorio de
  proveedores completo (es un solo listado, barato de hacer entero) pero el catálogo de
  *productos* se acota a lo que el piloto necesita: los productos simples de Iguazú que ya
  aparecieron en la muestra de reservas de Kilroy, los 7 tours compuestos top-seller del riesgo
  #6 del PRD y **los paquetes de un destino que forman esos 7 tours** (agregado 2026-10-02:
  sin ellos los tours no se pueden armar). No se suman otros destinos (Salta, Bariloche, etc.):
  el resto del catálogo se carga cuando se sumen más agencias/productos (`prd.md` §5).
- **Journaway y su hoja propia de productos** — pospuesto (`prd.md` §5).
- **Costos, márgenes, precios** — no se guardan (`modelo-de-datos.md`).

## 3. Preguntas y riesgos

**No hay preguntas bloqueantes para escribir este plan** — el PRD y la arquitectura ya lo
resuelven. Quedan dos cosas para resolver **antes de construir M1-01** (no antes de planear):

1. **Cuentas de Vercel / Supabase / Google Cloud (para el login):** ¿se crean con tu cuenta
   personal o con una cuenta de la empresa? Recomendado: empresa, desde el día uno (`stack.md`
   "Abierto"). Avisame cuál cuando arranquemos `/implementar M1-01` y las creamos juntos.
2. **Alcance exacto de productos simples de Iguazú a cargar en M1-04:** asumo los que aparecen en
   la muestra de reservas (`OD010A/B/C/D`, variantes de Iguazú Falls). Si hay otros que sabés que
   la agencia piloto pide seguido, decímelo antes de esa spec y los sumamos sin costo extra.
   **Resuelto (2026-09-27):** son 5 — `OD010A/B/C/D` + `OD011` (Iguazu Glamping), vendidos por
   Kilroy y TourRadar. La ficha M1-04 ya lo refleja.

**Ampliación del 2026-10-02 (piezas M1-04c y M1-04d).** Al revisar M1-05 apareció un hueco:
los 7 tours se arman con paquetes de un destino que no estaban cargados (solo Iguazú). Sin
preguntas bloqueantes: el owner ya dejó todo lo que hacía falta en `Insumos/`:
- **Los códigos:** cada componente de los 7 tours tiene su código en `RutasenBus2020.xls`, en la
  fila de arriba de "Net Prices:". Los 19 códigos existen en el Excel de paquetes, incluidos
  COMPBR10 (São Paulo) y BOCHI04R.
- **Los itinerarios día por día:** los 4 Word de catálogo ("One / Two / Multi Destination /
  Unique Tours … .docx") traen las noches por lugar y qué buses son nocturnos. Se usan en M1-05.
- **Los paquetes a cargar son 17:** OD013, OD016, OD017, OD018, OD019, OD020, OD022, OD025,
  OD029, OD030, OD031, OD032, OD033, CH10, COMPCH01, COMPBO20 y COMPBR10 (OD010A/D ya están).

**Por qué en dos piezas, y no una por región:** con Iguazú, lo caro no fue el código sino las
preguntas al owner (equivalencias, niveles, líneas viejas). Por eso **M1-04c hace primero un
diagnóstico de los 17 paquetes sin escribir en la base** y junta todas las dudas en una sola
lista. El owner la responde de una vez y **M1-04d carga todo con los datos ya confirmados**. Si
el diagnóstico muestra que algún destino trae mucho lío, M1-04d se parte por región ahí.

**Abierto, no bloquea este plan:**
- **La ficha de M1-05 hay que reescribirla antes de construirla:** cambió su fuente. Ahora tiene
  códigos explícitos en RutasenBus y fechas desde los Word. Además apareció un tour dentro de otro
  (5C01 usa CHB31 entero), noches de más o de menos ("OD019 (menos 1 noche)"), servicios
  incluidos en otro paquete ("(esta incluido en CH10)") y tours que se pueden hacer al revés.
  Se hace con `/specs M1-05` cuando M1-04d esté terminada.
- **Kilroy no siempre usa nuestros códigos** (`DECISIONS.md` 2026-10-02): las filas
  "Kilroy = OD0xx" de `codigo_externo` se revisan en M2, no en M1.

**Riesgos (heredados del PRD, aplicados a este plan):**

| Riesgo | Cómo se maneja en M1 |
|---|---|
| Los tours compuestos son más difíciles de catalogar de lo esperado (PRD riesgo #6). | M1-05 es su propia spec, después de probar el importador con productos simples en M1-04. Si un tour top-seller tarda mucho más que un producto simple, se ajusta el modelo ahí, antes de seguir con los otros 6. |
| El directorio de proveedores no está listo a tiempo (PRD riesgo #3). | Mitigado: tu Excel de proveedores ya tiene ~200 contactos con mail. M1-03 carga eso completo; lo que quede sin mail reconocible entra a la cola "sin mail" de la pantalla de Directorio (M1-06), visible para completar. |
| El Excel de paquetes es una planilla para humanos (fórmulas, bloques por columna), frágil de leer. | M1-04 y M1-05 usan IA como respaldo para interpretar bloques que las reglas simples no resuelven (`integraciones-ia.md`); lo que no se entiende con confianza queda en la cola de revisión, nunca se inventa. |
| Los 17 paquetes nuevos traen proveedores con nombres distintos al directorio, o que no están en él (como pasó con Tetris). | M1-04c los lista todos antes de cargar. El loop principal propone las equivalencias (como en M1-04b) y el owner las confirma de una vez. Lo que no tenga proveedor queda "sin resolver" y visible en M1-06, nunca inventado. |
| Correr las pruebas vuelve a importar los Excel sobre la base real y pisa lo cargado a mano. | Hasta M1-06 todo sale de los Excel y de los archivos de `data/`, así que no se pierde nada. M1-06 decide cómo proteger las correcciones manuales antes de habilitarlas. |

## 4. Reglas del proyecto que toca este milestone

- **#1** — se crean las tablas del catálogo con RLS activada, aunque el modelo sea de datos
  compartidos por todo el equipo (no hay aislamiento por usuario que aplicar aquí).
- **#2** — M1-01 da de alta las primeras claves del proyecto (Supabase, Google OAuth): van a
  variables de entorno en Vercel, nunca al código.
- **#3** — M1-04/M1-05 usan la IA como respaldo para leer el Excel de paquetes; corre bajo el
  mismo techo de gasto de `integraciones-ia.md` (US$ 20/mes).
- **#5** — siempre: cada spec cierra con sus 3 verificaciones en verde.
- *(La #4, aprobación humana en efectos externos, no aplica a M1: no hay ninguna acción hacia
  afuera todavía — eso empieza en M3.)*

## 5. Las piezas de trabajo (ESTA TABLA ES EL ESTADO)

| ID | Pieza | Estado | Depende de | Ficha |
|---|---|---|---|---|
| M1-01 | Base de la app: Next.js + Supabase + login con Google (dominio restringido) + deploy en Vercel | ✅ terminada — V1, V2 y V3 en verde (recorrido real confirmado en `https://automatizacion-dun.vercel.app` con `operations@hitravel.com.ar`) | — | `docs/sdd/specs/M1-01-base-de-la-app.md` |
| M1-02 | Esquema de datos del catálogo (producto, proveedor, producto_servicio, producto_componente, codigo_externo, importacion) | ✅ terminada — 6 tablas + RLS aplicadas al proyecto real, 52/52 tests en verde | M1-01 | `docs/sdd/specs/M1-02-esquema-de-catalogo.md` |
| M1-03 | Importador: directorio de proveedores (desde el Excel de proveedores) | ✅ terminada — 214 proveedores cargados en la base real (182 con mail, 8 WhatsApp, 24 sin mail), 132/132 tests en verde; respaldo de IA probado sin llamada real (falta `ANTHROPIC_API_KEY`) | M1-02 | `docs/sdd/specs/M1-03-importador-proveedores.md` |
| M1-04 | Importador: productos simples + sus servicios y proveedores (Iguazú, piloto) | ✅ terminada — 5 productos, 29 filas de servicio con niveles y prioridades, 15 códigos externos (incl. TourRadar); 205/205 tests. **Ojo:** 29/29 servicios con proveedor sin resolver (los nombres del Excel no coinciden con el directorio): se resuelve antes de M1-06 | M1-03 | `docs/sdd/specs/M1-04-importador-productos-simples.md` |
| M1-04b | Equivalencias de proveedores (nombres del Excel ↔ directorio) + niveles confirmados de Iguazú | ✅ terminada — 15 equivalencias; los 29 servicios con Booking Supplier y mail salvo Tetris (sin mail) y Beer (asignado a Tangoinn, a confirmar con ops); 243/243 tests | M1-04 | `docs/sdd/specs/M1-04b-equivalencias-de-proveedores.md` |
| M1-04c | Diagnóstico de los 17 paquetes de un destino de los 7 tours: el importador acepta cualquier lista de códigos y corre en modo "solo leer". Entrega un reporte por paquete (servicios, niveles, proveedores sin emparejar, líneas que no entiende) sin escribir en la base | ✅ terminada — 16 de 17 bloques encontrados (COMPBO20 sin bloque propio); 41 de 126 servicios con proveedor; 44 nombres a confirmar; reporte en `docs/sdd/diagnosticos/`; 302/302 tests | M1-04b | `docs/sdd/specs/M1-04c-diagnostico-paquetes-de-los-tours.md` |
| M1-04d | Carga de los 17 paquetes con sus equivalencias (ahora por destino) y niveles confirmados por el owner | ✅ terminada — 17 paquetes, 146 servicios: 126 con mail, 13 por WhatsApp, 4 manuales, 3 pendientes (NH Cordillera, Antarctica Hostel, O Hostel GRU); 352/352 tests | M1-04c + respuestas del owner al diagnóstico | `docs/sdd/specs/M1-04d-carga-paquetes-de-los-tours.md` |
| M1-05 | Los 7 tours compuestos: secuencia en el orden del viaje (Word), noches y día de inicio por componente, buses nocturnos, tour dentro de otro tour, buses con proveedor, categorías tour ↔ paquete. **Ficha reescrita el 2026-10-05** | ✅ terminada — los 7 tours armados (49 componentes, 2 buses con proveedor), ninguno para revisar; 401/401 tests. Pendiente del owner: categorías tour ↔ paquete y confirmar buses | M1-04d | `docs/sdd/specs/M1-05-importador-tours-compuestos.md` |
| M1-06 | Pantallas de Catálogo y Directorio, **solo lectura** (decisión 2026-10-06): listar, buscar, detalle con niveles, prioridades, estados y tours día por día; pendientes; logo y colores reales | 🔵 en curso | M1-04d, M1-05 | `docs/sdd/specs/M1-06-pantallas-catalogo-y-directorio.md` |

## 6. Cuándo está terminado el milestone

- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones de M1 en `docs/prd.md` se cumplen y se pueden demostrar: catálogo cargado
      (simples + tours compuestos), directorio con mails, y "dado un producto → sus proveedores
      con mail" visible en pantalla.
- [ ] **El owner lo probó con sus ojos:** el agente le dejó la app levantada y el link servido, y
      él confirmó que lo que ve está bien (buscar el Overland CHB31 y ver sus proveedores es la
      prueba sugerida).
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.

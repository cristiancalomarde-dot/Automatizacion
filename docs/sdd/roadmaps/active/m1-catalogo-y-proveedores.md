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
  aparecieron en la muestra de reservas de Kilroy, y los 7 tours compuestos top-seller del riesgo
  #6 del PRD. El resto del catálogo se carga cuando se sumen más agencias/productos (`prd.md` §5).
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

**Riesgos (heredados del PRD, aplicados a este plan):**

| Riesgo | Cómo se maneja en M1 |
|---|---|
| Los tours compuestos son más difíciles de catalogar de lo esperado (PRD riesgo #6). | M1-05 es su propia spec, después de probar el importador con productos simples en M1-04. Si un tour top-seller tarda mucho más que un producto simple, se ajusta el modelo ahí, antes de seguir con los otros 6. |
| El directorio de proveedores no está listo a tiempo (PRD riesgo #3). | Mitigado: tu Excel de proveedores ya tiene ~200 contactos con mail. M1-03 carga eso completo; lo que quede sin mail reconocible entra a la cola "sin mail" de la pantalla de Directorio (M1-06), visible para completar. |
| El Excel de paquetes es una planilla para humanos (fórmulas, bloques por columna), frágil de leer. | M1-04 y M1-05 usan IA como respaldo para interpretar bloques que las reglas simples no resuelven (`integraciones-ia.md`); lo que no se entiende con confianza queda en la cola de revisión, nunca se inventa. |

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
| M1-02 | Esquema de datos del catálogo (producto, proveedor, producto_servicio, producto_componente, codigo_externo, importacion) | ⬜ pendiente | M1-01 | `docs/sdd/specs/M1-02-esquema-de-catalogo.md` |
| M1-03 | Importador: directorio de proveedores (desde el Excel de proveedores) | ⬜ pendiente | M1-02 | `docs/sdd/specs/M1-03-importador-proveedores.md` |
| M1-04 | Importador: productos simples + sus servicios y proveedores (Iguazú, piloto) | ⬜ pendiente | M1-03 | `docs/sdd/specs/M1-04-importador-productos-simples.md` |
| M1-05 | Importador: tours compuestos + regla de transfers (los 7 top-seller) | ⬜ pendiente | M1-04 | `docs/sdd/specs/M1-05-importador-tours-compuestos.md` |
| M1-06 | Pantallas de Catálogo y Directorio (listar, buscar, detalle con proveedores/mails, colas "sin mail" / "para revisar") | ⬜ pendiente | M1-04, M1-05 | `docs/sdd/specs/M1-06-pantallas-catalogo-y-directorio.md` |

## 6. Cuándo está terminado el milestone

- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones de M1 en `docs/prd.md` se cumplen y se pueden demostrar: catálogo cargado
      (simples + tours compuestos), directorio con mails, y "dado un producto → sus proveedores
      con mail" visible en pantalla.
- [ ] **El owner lo probó con sus ojos:** el agente le dejó la app levantada y el link servido, y
      él confirmó que lo que ve está bien (buscar el Overland CHB31 y ver sus proveedores es la
      prueba sugerida).
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.

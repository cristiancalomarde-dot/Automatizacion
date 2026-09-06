---
description: Define la solución (el QUÉ del producto) según su tipo, a partir del ICP, siguiendo la skill solution-anatomy. Escribe docs/solucion.md, un bloque por vez con validación del owner. Lo comercial (descuentos, urgencia, bonos) queda para la oferta.
argument-hint: "<tipo: curso|implementacion|acompanamiento|producto> [ruta-icp] [descripción] [--fast]"
---

# /solucion — Arquitecto de Soluciones

Definí la solución —**qué es el producto y qué recibe el cliente**— con la doctrina de
la skill **`solution-anatomy`** (cargala antes de producir: el límite solución↔oferta,
el template por tipo y las reglas de proceso son la autoridad — este comando solo
orquesta). Acá el producto se describe honesto y al grano, con su **precio base**; la
máquina comercial es de la OFERTA, no de este documento.

Entrada: **$ARGUMENTS**

## Paso 0 — Resolvé tipo, ICP y contexto
1. **Tipo** (`$1`): elige la anatomía del template. Si falta → pedilo y pará (no lo asumas).
2. **ICP**: si `$2` trae una ruta, leé ese archivo (si no existe → error claro, pará).
   Si no viene, usá **`docs/icp.md`**. Si no hay ICP → avisá que la solución sale mucho
   mejor con ICP y ofrecé correr `/icp` primero, o seguir con un ICP-supuesto declarado
   en el propio documento.
3. **Descripción** (resto de args, opcional): usala como insumo. Si ya existe
   `docs/solucion.md`, se **audita y refina** contra el ICP — no se reinventa.

## Paso 1 — Preguntas de alto valor (máx 3-5, un solo bloque)
Solo las que no puedas inferir del ICP o la descripción, y que cambien el output:
- ¿Cuál es el resultado concreto que se lleva el cliente?
- ¿Formato/modalidad de entrega y duración?
- ¿Qué necesita el cliente para usarlo? (requisitos, costo de herramientas)
- ¿Cuál es el **precio base** (ancla/general, sin descuentos)?

Con `--fast`: no preguntes, asumí lo razonable y registrá los supuestos.

## Paso 2 — Construí la solución
Un bloque por vez, validando con el owner, siguiendo el template del **tipo** (o el
fallback genérico de la skill). Nada comercial salvo el precio base.

## Paso 3 — Producí y cerrá
- Escribí **`docs/solucion.md`** (si ya existe, refinamiento in-place), encabezado con:
  `> Basado en: <ruta-icp> | Tipo: <tipo> | Supuestos abiertos: N | Fecha: YYYY-MM-DD`,
  y cerralo con una sección **"Supuestos abiertos"** (los riesgosos 🔴).
- Decisiones clave (tipo, resultado prometido, precio base, formato) → `DECISIONS.md`.
- Cerrá sugiriendo: **`/prd`** usando `docs/icp.md` + `docs/solucion.md` como
  insumos, para bajar la solución a un PRD construible.

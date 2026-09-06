# El método — de la idea a la app publicada

> **Dueño de:** el proceso de trabajo: qué etapa sigue a cuál, qué produce cada una y qué
> significa "terminado". Las reglas innegociables viven en [`constitucion.md`](constitucion.md);
> el alcance, en [`../prd.md`](../prd.md); el diseño técnico, en
> [`../arquitectura/`](../arquitectura/README.md).

---

## La idea en una frase

En vez de pedirle todo junto a la IA, el trabajo se parte en **piezas chicas con un contrato
claro de "terminado"**, y cada etapa tiene un responsable del equipo de agentes.

## El flujo (4 etapas + red de seguridad)

| Etapa | Comando | Quién | Qué produce |
|---|---|---|---|
| 0 · Para quién | **`/icp`** | Investigador de ICP | `docs/icp.md`: tu cliente ideal (opcional, antes del PRD) |
| 0 · Qué le ofrecés | **`/solucion <tipo>`** | Arquitecto de Soluciones | `docs/solucion.md`: el QUÉ del producto (opcional) |
| 1 · El qué | **`/prd`** | Analista de Producto | `docs/prd.md`: qué construimos, en qué orden, y qué queda afuera |
| 2 · El cómo | **`/arquitectura`** | Arquitecto | `docs/arquitectura/` (un doc por tema) + reglas numeradas en la constitución |
| 3 · El orden | **`/roadmap M#`** | Planificador | El plan del milestone con su tabla de piezas (`roadmaps/active/`) |
| 4 · Las instrucciones | **`/specs`** | Planificador | La ficha de cada pieza (`specs/`) |
| 5 · La construcción | **`/implementar <ID>`** (o prosa: *"construí `<ID>`"*) | Programador (`builder`) | Código con las 3 verificaciones en verde, una pieza a la vez |
| 6 · Publicar | **`/deploy`** | DevOps + Diseñador | Control listo-para-publicar y, con GO + confirmación, la app online |

Transversales: **`/empezar`** te dice dónde estás y qué toca; **`/save-point <etiqueta>`** deja
un punto de retorno en Git antes de un cambio grande — siempre se puede volver atrás.

## Dos conceptos, un solo estado

- **El plan** (`roadmaps/active/<slug>.md`) es el índice de un milestone: qué piezas hay, en qué
  orden, y **el estado de cada una — este es el ÚNICO lugar donde vive el estado**.
- **La spec** (`specs/<ID>-<tema>.md`) es la ficha de UNA pieza: qué logra, cómo se comprueba,
  qué queda afuera. No lleva estado propio.

IDs: `M#-##` (milestone del PRD + orden). Al cerrar un milestone, su plan se mueve a
`roadmaps/archive/`. Las specs terminadas no se borran: quedan como registro.

## Qué significa "terminado" (regla #5)

Una pieza está terminada cuando pasan **las 3 verificaciones, en orden**:
1. **Tests unitarios + linter** — cada parte funciona sola y el código está prolijo.
2. **Integración** — las partes funcionan juntas (y si hay datos de usuarios, uno no ve lo de otro).
3. **El recorrido completo** — lo que promete la pieza corre de punta a punta, como lo usaría una
   persona.

"El código está escrito" **no** es terminado. Y el alcance se achica quitando piezas, **nunca**
bajando la vara de terminado (regla de gestión, `docs/prd.md` §8).

Y un milestone entero cierra con un paso humano: **"probalo vos"** — el agente deja la app
levantada, entrega el link listo, y el owner confirma con sus ojos que lo que ve está bien.
Recién ahí el plan se archiva.

---

## Anexo técnico (para los agentes)

- **Test primero:** ningún test se da por bueno sin verlo fallar antes por la razón correcta.
- **Una pieza a la vez:** no se arranca la siguiente spec con la actual sin terminar; sin
  refactor colateral ("ya que estoy").
- **Un hecho, un dueño:** las reglas se citan por `#<n>` (constitución), nunca se transcriben; el
  diseño se linkea a su doc de `docs/arquitectura/`, no se repite.
- **Base primero:** nada se construye hasta que la demanda real lo llame.
- Si una verificación falla: fix con causa raíz antes de re-correr; no se re-corre "a ver si pasa".

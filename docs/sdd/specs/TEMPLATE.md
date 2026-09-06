<!--
Plantilla de SPEC — la ficha de UNA pieza de trabajo. Copiala a docs/sdd/specs/<ID>-<tema>.md
y completala. Las secciones que no aplican SE BORRAN (no hace falta justificar).
El estado (pendiente / en curso / terminada) NO vive acá: vive en la tabla del plan.
-->

# <M#-##> · <título corto, ej. "El formulario de 4 pasos">

**Depende de:** <IDs de otras specs, o "nada">

## 1. Qué queremos lograr
<1-2 frases en llano: el resultado que alguien va a poder ver funcionando, y para qué sirve.>

## 2. Qué hay hoy
<El punto de partida: qué existe ya en el proyecto que esta pieza usa, cambia o reemplaza.
Si el proyecto arranca de cero, borrá esta sección.>

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)
<Una fila por requisito. La prueba es concreta: algo que pasa o no pasa, sin interpretación.
Incluí al menos una prueba de lo que NO debe pasar (el error que se maneja, el acceso que se
rechaza).>

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | … | … |

## 4. Qué ve el usuario (solo si la pieza tiene interfaz)
<Si la pieza no tiene pantalla, borrá esta sección. Si la tiene, declará:
- **Pantallas o vistas** que agrega o cambia.
- **El recorrido**: qué hace el usuario, paso a paso, hasta llegar al resultado.
- **Los tres estados**: qué ve mientras espera (carga), si algo falla (error) y si no hay
  nada que mostrar (vacío). Estos estados son criterios de la tabla de §3, no opcionales.>

## 5. Qué queda afuera
<Lo que alguien podría esperar y esta pieza NO incluye. Una cosa a la vez.>

## 6. Reglas del proyecto que toca
<Las reglas innegociables de [la constitución](../constitucion.md) que esta pieza toca, citadas
por número, con una línea de cómo se cumplen acá. Si no toca ninguna aparte de la #5 (que aplica
siempre), dejá solo esa línea.>

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#<n>** — <cómo se cumple en esta pieza>

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter → 2) integración
  (si hay datos de usuarios, incluye la prueba de que un usuario no ve lo de otro) → 3) el
  recorrido completo de punta a punta. No se avanza a una capa con la anterior en rojo; si una
  falla: causa raíz → arreglo mínimo → re-correr.
- **Test primero:** el test se escribe antes de la implementación y se lo ve fallar por la razón
  correcta antes de darlo por bueno.
- **Entregables:** rutas concretas de archivos nuevos/modificados, incluida la interfaz si la
  pieza toca al usuario. La pieza cierra con su superficie real funcionando, no solo con código.
- **Diseño y alcance no se deciden acá:** el cómo va a su doc de `docs/arquitectura/`; el si
  entra o no, a `docs/prd.md`.

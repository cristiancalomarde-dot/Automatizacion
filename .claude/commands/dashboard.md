---
description: El tablero visual del proyecto — regenera y republica el artefacto de estado para el owner (resumen, progreso, ritmo, técnica, equipo, avisos, en tabs). Siempre al MISMO URL.
argument-hint: ""
---

# /dashboard

Regenerá el tablero visual de estado del proyecto y republicalo como Artifact. Corrés en el
loop principal. El resultado es para un owner NO técnico: lenguaje llano, voseo, cero jerga.

**URL del artefacto (fijo — republicar siempre acá, nunca crear uno nuevo):**
`<pendiente — se crea en la primera publicación; pegá acá el URL que devuelva Artifact>`
**Archivo fuente:** `docs/sdd/dashboard/tablero.html` (mismo path siempre; cambiar el path crea otro artefacto).

## Fuentes de verdad (releer en cada corrida)

1. **Estado de las piezas:** la tabla del plan activo en `docs/sdd/roadmaps/active/*.md`
   (la ÚNICA fuente de estado; ✅/🔵/⬜). Si `active/` está vacío, el milestone se archivó:
   mirá `docs/sdd/roadmaps/archive/` y `docs/prd.md` para saber cuál sigue.
2. **Milestones y alcance:** `docs/prd.md` §3 (condiciones de terminado), §4 (riesgos), §6 (preguntas abiertas).
3. **Ficha técnica:** `docs/arquitectura/` (stack, modelo-de-datos, user-flow, marca — respetar
   qué sigue "a validar" y qué ya validó el owner).
4. **Contexto:** `PROGRESS.md` (próximo paso, "ojo con"), `DECISIONS.md` (últimas 3-4 decisiones),
   `git log` + `git status` (qué está commiteado y qué no).
5. **Ritmo — sesiones de Claude:** los `.jsonl` en
   `~/.claude/projects/-Users-damian-Desktop-Novolabs-Demo-Template/`.
   - Usá `jq 'select(.timestamp)'` (la primera línea no tiene timestamp); duración de sesión =
     min→max timestamp. La duración REAL de cada pieza sale de sus subagentes:
     `<sesión>/subagents/*.meta.json` tiene `description` tipo "Construir spec M1-XX" y el
     `.jsonl` hermano tiene los timestamps.
   - **Separá trabajo de espera:** calculá los huecos entre timestamps consecutivos del subagente;
     un hueco > 2 min es espera (permiso, dato del owner), no trabajo. Mostrá ambos.
   - `type: "file-history-delta"` → `trackingPath` dice qué archivo se escribió y cuándo.
   - No leas archivos enteros: `jq` selectivo + grep contados.

## Estructura del tablero (tabs — una sección por tab, para no abrumar)

Header fijo (nombre, una línea, fecha/hora del snapshot) + barra de tabs sticky con 6 tabs.
Cada tab termina con un botón "Ver … →" al siguiente. Mantener este orden y contenido:

1. **Resumen:** 4 KPIs (milestone, piezas terminadas, tests en verde, estimado a cierre) +
   tarjeta "El único paso siguiente" (comando exacto o acción del owner) + "Lo que te espera a vos".
2. **Progreso:** 3 milestones con barra + lista de specs del milestone activo (estado, dependencias
   en llano, la 🔵 resaltada) + checklist de condiciones de cierre del milestone.
3. **Ritmo:** barras por etapa del método · barras por pieza construida separando trabajo real de
   espera · 2 KPIs · proyección honesta (rango + caveat) · 3 sugerencias concretas para acelerar.
4. **Técnica:** stack (badges), modelo de datos (entidades), recorrido del usuario (pasos con
   hecho/actual/apagado), marca del producto con etiqueta "a validar" mientras corresponda.
5. **Equipo:** pipeline de los 8 comandos con el actual resaltado, roles (incluido "Vos"),
   reglas de la constitución (tildadas las que ya aplica el código), últimas decisiones.
6. **Avisos:** solo lo vigente, cada uno con etiqueta de a quién le toca (ámbar = acción;
   rojo/info = contexto). Borrar los ya resueltos.

## Look and feel — brand kit de Novolabs (NO la marca del producto)

Tomado de la landing de Novolabs (`~/Desktop/Novolabs Organization/Spaces/Novo OS/outputs/novolabs/landing/index.html`):
- **Dark-first:** fondo `#141414`, tarjetas `#1D1D1D`, líneas `rgba(255,255,255,.10)`, texto blanco.
  Tema claro también definido (fondo blanco, `#F2F2F2`).
- **Acento único:** `#E5442A` (hover `#CC3A22`). Verde `#3FBF6A` solo para "terminado/ok";
  ámbar solo para avisos. Nada de gradientes.
- **Tipografía:** display "General Sans" 600 con letter-spacing negativo (no está self-hosteada
  ni se puede cargar de Fontshare por el CSP → cae al stack de sistema, igual que la landing);
  texto Inter (Google Fonts sí carga).
- **Formas:** radio 14px en tarjetas, píldoras (999px) en botones/tabs/etiquetas, eyebrows en
  mayúsculas con letter-spacing .16em y una raya de 26px delante.
- Sin emojis decorativos. Tabs accesibles (role=tab, flechas del teclado, hash en la URL).

## Cómo publicar

1. Reescribí `docs/sdd/dashboard/tablero.html` con los datos recalculados, conservando la
   estructura de tabs y el brand kit de arriba. El archivo arranca con `<meta charset="utf-8">`
   y `<meta name="viewport" …>` — sin eso, abierto local con `file://` los acentos se rompen.
2. Publicá con la tool Artifact: mismo `file_path`, favicon `🧭`, título `Tablero del proyecto`.
   **Primera publicación (URL todavía pendiente arriba):** publicá SIN `url:`; Artifact crea el
   artefacto y te devuelve un URL — pegalo en la línea "URL del artefacto" de arriba para que las
   próximas corridas lo reusen. **Corridas siguientes:** desde OTRA conversación distinta a la que
   lo creó, pasá además `url:` con ese URL fijo — sin eso se crea un artefacto duplicado. Si la
   publicación falla con "deleted / no access", el artefacto fue borrado: publicá con un `file_path`
   nuevo y actualizá el URL y el archivo fuente en este comando.
3. Entregale al owner el link y 2-3 frases con lo que cambió desde la última foto.

> Solo lectura sobre el repo salvo el propio `tablero.html`. No actualices PROGRESS.md ni la
> tabla del plan desde acá — este comando fotografía el estado, no lo cambia.

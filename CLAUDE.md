# <Nombre del proyecto>

## Overview
<Una o dos oraciones que dejen claro QUÉ es esto.>
Stack: <ej. Next.js + Vercel>.

## Quick Start
- Instalar: `<npm install | ...>`
- Levantar en dev: `<npm run dev | ...>`
- **Verificación completa: `<npm test && npm run lint | make check>`**

## Las reglas del proyecto
Las reglas innegociables, numeradas y citables por `#<n>`, viven en `docs/sdd/constitucion.md`.
Las tres de trabajo diario:
- **Una cosa a la vez:** una spec por vez; la siguiente arranca cuando la actual está terminada.
  Sin refactor colateral ("ya que estoy").
- **Terminado = las 3 verificaciones en verde, en orden** (regla #5). "El código está escrito" no
  es terminado.
- **Base primero:** nada se construye hasta que la demanda real lo llame; el alcance se achica
  quitando piezas, nunca bajando la vara de terminado.

## El equipo de agentes
Cada etapa tiene su responsable. Nombralos al invocarlos.

| Rol | Cómo se invoca | Qué hace |
|---|---|---|
| Investigador de ICP (`icp-researcher`) | `/icp [idea]` | Para quién construimos → `docs/icp.md` (opcional, antes del PRD) |
| Arquitecto de Soluciones (`solution-architect`) | `/solucion <tipo>` | El QUÉ del producto → `docs/solucion.md` (opcional, antes del PRD) |
| Analista de Producto | `/prd <idea>` | La idea → el PRD (el qué de la app) |
| Arquitecto | `/arquitectura` | El PRD → las decisiones técnicas (el cómo) |
| Planificador | `/roadmap <M#>` → `/specs` | El milestone → el plan (orden) → las fichas (instrucciones) |
| Programador (`builder`) | `/implementar <ID>` (o prosa: "construí `<ID>`") | Una spec → código verificado (3 verificaciones) |
| Diseñador de Producto (`ux-reviewer`) | lo despacha `/arquitectura` (autor) · prosa: "revisá que no parezca de IA" (auditor) | Define user-flow y marca; después audita que la app no parezca prototipo |
| DevOps (`deploy-engineer`) | `/deploy [entorno]` | Control listo-para-publicar + deploy real con tu OK |
| Estimador de Costos (`cost-estimator`) | `/costo` | La foto del costo mensual (infra + IA) → `docs/arquitectura/costos.md` |
| Instalador de Monitoreo (`sentry-installer`) | `/instalar-sentry` | Sentry capturando errores (vía el `builder`) → `docs/arquitectura/sentry.md` |
| Instalador de Analítica (`posthog-installer`) | `/instalar-posthog` | PostHog midiendo producto (vía el `builder`) → `docs/arquitectura/posthog.md` |
| *(puerta de entrada)* | `/empezar` | Dónde está el proyecto y cuál es el único paso siguiente |
| *(tablero visual)* | `/dashboard` | Foto de estado para el owner, republicada como Artifact |
| *(red de seguridad)* | `/save-point <etiqueta>` | Punto de retorno en Git |

## Flujo y estado
- **Método (los 8 comandos):** `/icp` → `/solucion` → `/prd` → `/arquitectura` → `/roadmap` →
  `/specs` → `/implementar` → `/deploy`. Guía completa: `docs/sdd/README.md`. Si el owner no
  sabe qué toca: `/empezar`.
- **Herramientas auxiliares (fuera del flujo lineal, se usan cuando hacen falta):** `/costo` (la
  foto del costo, antes de publicar), `/instalar-sentry` y `/instalar-posthog` (monitoreo y
  analítica, cuando la app ya corre), `/dashboard` (foto de estado para el owner) y `/save-point`
  (red de seguridad en Git).
- **El estado de las piezas vive en UN solo lugar:** la tabla del plan activo en
  `docs/sdd/roadmaps/active/`.
- **"Probalo vos" al cerrar cada milestone:** cuando la última pieza de un plan queda en ✅,
  levantá la app en background (`npm run dev` o equivalente) y entregale al owner el link listo
  (ej. `http://localhost:3000`) + qué probar en 1-2 frases. El owner nunca levanta servers. El
  milestone no se archiva sin su confirmación de que lo que ve está bien.
- **Nota entre sesiones:** `PROGRESS.md` (dónde retomar). **Porqués:** `DECISIONS.md`.

### Al iniciar la sesión
1. Leer `PROGRESS.md` y la tabla del plan activo.
2. Correr la verificación completa para confirmar estado consistente.
3. Continuar desde donde dice `PROGRESS.md`, una cosa a la vez.

### Antes de cerrar la sesión
1. Verificación completa en verde.
2. Tabla del plan y `PROGRESS.md` al día; sin artefactos de debug sueltos.
3. Trabajo commiteado (qué + por qué); decisión durable → `DECISIONS.md`.

## Documentos (leer bajo demanda)
- **Alcance y milestones:** `docs/prd.md` · **Decisiones técnicas:** `docs/arquitectura/` (un doc por tema; índice en su README)
- **El método y las plantillas:** `docs/sdd/README.md` · **Reglas numeradas:** `docs/sdd/constitucion.md`

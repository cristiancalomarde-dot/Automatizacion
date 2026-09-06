# Arnés SDD — punto de partida

Repositorio limpio con el **arnés de Spec-Driven Development**: el equipo de agentes, skills y comandos del método, más las plantillas de documentos. Sin código de aplicación — el proyecto arranca desde acá.

## Qué hay

- **`.claude/`** — agentes, skills y comandos del método.
- **`CLAUDE.md`** — plantilla del archivo de entrada del agente (completá los placeholders `<...>`).
- **`docs/prd.md`** — plantilla del PRD (la completa `/prd`).
- **`docs/arquitectura/`** — las decisiones técnicas, un doc por tema (los crea `/arquitectura`).
- **`docs/sdd/`** — el método: constitución + plantillas de roadmaps (`roadmaps/`) y specs (`specs/`).
- **`PROGRESS.md` / `DECISIONS.md`** — plantillas de estado entre sesiones.

## Cómo arrancar

1. Corré **`/empezar`** (o directo **`/prd <idea>`** si ya tenés la idea clara).
2. Seguí el flujo: `/arquitectura` → `/roadmap <M#>` → `/specs` → `/implementar <ID>` → `/deploy`.
3. Guía completa del método: `CLAUDE.md` y `docs/sdd/README.md`.

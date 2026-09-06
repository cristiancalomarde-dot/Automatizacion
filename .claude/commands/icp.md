---
description: Define el Ideal Customer Profile (para quién construimos) siguiendo la skill icp-research. Escribe docs/icp.md, sección por sección con validación del owner. Es el origen del pipeline; no consume otros entregables.
argument-hint: "[tema-o-idea opcional] [--fast]"
---

# /icp — Investigador de ICP

Definí el ICP con la doctrina de la skill **`icp-research`** (cargala ENTERA antes de
producir: su estructura, jerarquía de evidencia y reglas de proceso son la autoridad —
este comando solo orquesta). Si **$ARGUMENTS** trae un tema/idea, arrancá de ahí; si no,
preguntá cuál es la idea o producto.

## Paso 0 — Contexto
Leé la evidencia disponible en el repo (transcripciones, research, material del cliente
que el owner haya dejado o pase en el momento). Define si el ICP nace como
v1-hipótesis o parcialmente validado. NO preguntes lo que ya esté en esos insumos.

## Paso 1 — Preguntas de alto valor (máx 5, un solo bloque)
Solo las que cambian el output y no puedas inferir. Las decisivas:
1. ¿Qué idea/producto/servicio querés validar, en una frase?
2. ¿Es **un** ICP o sospechás más de un perfil? (un perfil por documento).
3. ¿Para qué se va a usar? Define los **módulos opcionales**: Marketing, Ventas,
   Social Listening, o solo el núcleo.
4. ¿Tenés evidencia del cliente o arrancamos como hipótesis? (define el `Estado`).
5. ¿Hay un competidor o solución casera donde YA gastan plata/tiempo?

Con `--fast`: no preguntes, asumí lo razonable y registrá los supuestos.

## Paso 2 — Construí el ICP siguiendo la skill
Sección por sección, validando con el owner antes de avanzar (núcleo de 8 secciones +
los módulos elegidos; el Snapshot se escribe al final pero se presenta primero).

## Paso 3 — Cerrá y producí
- Corré los tres tests del método (reconocimiento, evidencia, accionabilidad).
- Escribí **`docs/icp.md`** (si ya existe, se refina in-place). Encabezalo con el
  `Estado` (Hipótesis / Parcial / Validado — N=X) + fecha, y cerralo con una sección
  **"Supuestos abiertos"** marcando las 2-3 hipótesis más riesgosas 🔴.
- Decisiones clave (uno vs varios ICPs, nicho priorizado, módulos) → `DECISIONS.md`.
- Cerrá sugiriendo: **`/solucion <tipo>`** para definir el QUÉ del producto.

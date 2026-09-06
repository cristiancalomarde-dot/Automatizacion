---
description: La IA construye — despacha al Programador (builder) para construir UNA spec con test-primero y las 3 verificaciones. El loop actualiza la tabla del plan; si era la última pieza, sirve el "probalo vos".
argument-hint: "[ID de la spec, ej: M1-01 — vacío = la primera pendiente]"
---

# /implementar

Construí **una** pieza del plan: **$ARGUMENTS**

1. Si no viene ID, tomá la **primera pieza pendiente** de la tabla del plan activo
   (respetando dependencias) y decilo antes de arrancar.
2. Marcá la fila como 🔵 en curso y despachá al agente **`builder`** (Agent tool) con la
   ruta de la spec.
3. Con su reporte: si las 3 verificaciones quedaron en verde, marcá la fila ✅ y actualizá
   `PROGRESS.md`; si no, contá en llano qué falta y qué sigue.
4. Si era la **última pieza del milestone**, serví el "probalo vos" (según `CLAUDE.md`):
   app levantada en background + link listo + qué probar. Si no, ofrecé
   **`/implementar <siguiente ID>`**.

> Una pieza por vez. La prosa *"construí `<ID>`"* sigue funcionando igual que este comando.

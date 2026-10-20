# M3-06 · Nombre para la firma, responsable de la reserva y filtro "mis reservas"

**Depende de:** M3-03 (envío con la firma de quien envía) y M2-05 (lista y detalle de reservas). Pedido
por el owner el 2026-10-20 al revisar los primeros pedidos de prueba.

## 1. Qué queremos lograr
- **Firma:** cada operativo elige una vez cómo aparece su nombre en la firma de los pedidos (por ejemplo,
  "Damián Pérez" o "Damián · Operaciones"), en vez de depender del nombre de su cuenta de Google.
- **Responsable:** cada reserva muestra quién la lleva, para saber a quién preguntar. Se puede **tomar**
  una reserva o **pasarla a otro**.
- **Filtro:** en la lista, cada uno filtra **sus reservas** (o las de otro operativo) para encontrar una rápido.

## 2. Qué hay hoy
- **La firma** (M3-03): sale del nombre de la cuenta de Google de la sesión o, si no hay, de la parte del
  mail antes de la @ (`quienEnvia`, `src/lib/pedidos/pantalla.ts`). La tabla `usuario`
  (`supabase/migrations/0001_usuario.sql`) tiene a cada persona del equipo.
- **Los envíos:** `reserva_pedido` guarda `enviado_por` y `enviado_por_nombre` de cada pedido enviado (0019).
- **La lista** (`src/components/reservas/lista-reservas-pantalla.tsx`) tiene un buscador y los filtros de
  M2-05. **El detalle** es `detalle-reserva-pantalla.tsx`. El historial está en `evento_reserva`.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **"Mi nombre para la firma":** una pantalla chica (desde el menú o el nombre de la persona arriba) donde cada uno escribe cómo quiere firmar. Por defecto propone el nombre de Google. Se guarda en su `usuario` | Test: guardar y volver a entrar muestra lo guardado; vacío vuelve al nombre de Google |
| 2 | **La firma de los pedidos usa ese nombre** (diálogo de envío de M3-02 y mail de M3-03). Sin nombre guardado, sigue como hoy | Test: con nombre guardado, el diálogo y el mail enviado (SMTP falso) firman con él |
| 3 | **Responsable de la reserva:** campo nuevo. Si nadie la tomó, al enviar los primeros pedidos (modo real o de prueba) queda como responsable quien los envió | Integración: enviar sin responsable lo asigna; enviar con responsable no lo cambia |
| 4 | **"Tomar esta reserva"** en el detalle: la persona con la sesión queda como responsable. Si ya tenía otro, pregunta "La lleva <nombre>. ¿La tomás vos?" | Test de pantalla con y sin responsable previo |
| 5 | **"Pasarla a otro":** elegir a otra persona del equipo de una lista (los `usuario` del equipo) | Test: pasarla cambia el responsable y queda en el historial |
| 6 | **Se ve en la lista y en el detalle:** columna o etiqueta "Responsable: <nombre para la firma o nombre>", y "Sin responsable" si nadie la tomó | Test de pantalla |
| 7 | **Filtro por operativo en la lista:** "Mis reservas", "Sin responsable", "Todas" (por defecto) y cada persona del equipo. Se combina con el buscador y los filtros que ya hay. Se recuerda por persona en el navegador (no hace falta guardarlo en la base) | Test: elegir "Mis reservas" muestra solo las suyas; combinado con el buscador, filtra las dos cosas |
| 8 | **Historial:** "<persona> tomó la reserva", "<persona> se la pasó a <otra>" y "Responsable: <persona> (envió los primeros pedidos)" | Test: aparecen los eventos con autor |
| 9 | **Solo el equipo,** con sesión @hitravel.com.ar. Nadie puede poner como responsable a alguien que no es del equipo | Test: sin sesión rechaza; un id que no está en `usuario` rechaza |

## 4. Qué ve el usuario
- **Arriba, junto a su nombre:** "Mi nombre para la firma".
- **En la lista:** el responsable en cada fila y el filtro "Responsable: Todas · Mis reservas · Sin
  responsable · <cada persona>".
- **En el detalle:** "Responsable: Damián" con los botones "Tomar esta reserva" y "Pasarla a otro".
- **Estados:** "Guardando…", "Listo" y "No se pudo guardar: <motivo en llano>" con "Reintentar".

## 5. Qué queda afuera
- Avisos o notificaciones a la persona cuando le pasan una reserva.
- Permisos distintos por persona: todos los del equipo pueden ver y tomar todas las reservas.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#1:** solo con sesión del equipo; la lista de personas para "pasarla a otro" sale de `usuario`.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + pantalla + lint + tipos + build → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; el guard de `src/lib/entorno/base-de-pruebas.ts`)
  → 3) recorrido con las pantallas y server actions reales y una sesión de prueba, como M3-02 a M3-05.
  **Nunca** se escribe en la base real.
- **Test primero.** Los textos de pantalla van en `src/lib/textos/`.
- **Migración nueva** `0021_…sql` (columna del nombre para la firma en `usuario`, `reserva.responsable_id`
  → `usuario`, tipos de evento nuevos, y RLS para que cada uno edite solo su propio nombre de firma),
  aplicada **solo** a la base de pruebas con `--db-url` (`supabase/.temp/project-ref` apunta a la real:
  nunca hagas `db push` sin `--db-url`). La real la aplica el loop principal con el OK del owner.
- **Reusar:** `quienEnvia` (que pase a preferir el nombre para la firma), el envío de M3-03 (asignar el
  responsable en la misma operación que toma los pedidos) y los filtros de la lista de M2-05.

# M3-39 · "Marcar como resuelto" en cada motivo de revisión

**Depende de:** M3-30. Pedida por el owner el 2026-10-28: la reserva Petzold quedó "para revisión" por
"Journaway pide 'Night Bus Peru' …" y no hay forma de resolverlo desde la app, así que no se puede armar el
pedido ("Resolvé primero lo que está para revisión"). Hoy solo se resuelven algunos motivos (fechas, pax,
vuelos, producto: `src/lib/reservas/corregir/`, `confirmar/`).

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Cada motivo de revisión tiene "Marcar como resuelto"** en el detalle de la reserva, con una nota corta obligatoria (ej. "Journaway confirmó que era un error"; hasta `MAXIMO_NOTA`) | Pantalla: el botón está en cada motivo; sin nota no guarda |
| 2 | **Queda registrado:** evento en la reserva con quién, cuándo, qué motivo y la nota; se ve en el historial ("<persona> marcó como resuelto: <motivo> — <nota>") | Integración: el evento queda guardado y se muestra |
| 3 | **Sin motivos pendientes, la reserva pasa a "recibida"** (como hoy al corregir el último dato dudoso) y se pueden armar pedidos | Integración: Petzold-like con 1 motivo → resolverlo → "recibida"; con 2 → resolver uno sigue "para revisión" |
| 4 | **Los motivos que ya tienen su arreglo propio** (fechas, pax, vuelos, producto no seguro, posible duplicada) siguen con su botón actual; "Marcar como resuelto" es para el resto. Si es más simple ofrecerlo en todos, que no rompa los flujos existentes | Recorridos de corregir/confirmar en verde |
| 5 | **Solo el equipo con sesión** (RLS, como las otras acciones); una reserva cerrada/descartada/cancelada no se toca | Integración: sin sesión no escribe; descartada → error en llano |
| 6 | **Nada más cambia** | Recorridos M2/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Patrón a seguir: `revisarDato` / `corregirDato` en `src/lib/reservas/corregir/corregir.ts` (cálculo del estado
  con los motivos que quedan, eventos, `MAXIMO_NOTA`), textos en `src/lib/textos/index.ts`
  (`historialRevisado`, `listoRecibida`, `listoSigue`).

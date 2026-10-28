# M3-28 · Textos de los pedidos (segunda revisión del owner)

**Depende de:** M3-16 (asunto sin códigos), M3-25. Pedida por el owner el 2026-10-28
(`docs/sdd/diagnosticos/M3-04-revision-owner.md`, "Textos de los pedidos").

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Asunto con los pax:** "Solicitud de reserva – <pasajero> x <N> – <fechas>" en todos los pedidos (N = pax de la reserva; si no hay cantidad, sin "x N" y con aviso) | Unitario: 1, 2 y 3 pax; sin cantidad |
| 2 | **Sin códigos en el asunto:** en DK1595221 (Kilroy, BOCHI04R + OD010A) los mails a Beer Hotel y a Cuenca del Plata todavía muestran el código de Kilroy y el del producto. Encontrar por qué (¿otro camino del armado, pedido a mano, borrador editado que "Volver a armar" no pisa?) y corregir la causa | Unitario/integración con una reserva como DK1595221 |
| 3 | **Cuenca del Plata, Paquete 105 Premium:** el transfer in / out no dice "regular" (se pide un paquete Premium) | Unitario con OD010A/OD010B: ningún renglón del pedido a Cuenca dice "regular" en los transfers |
| 4 | **Transvip con una p:** en tareas y pedidos sale "Transvip", aunque el Excel diga "Transvipp" | Unitario: la tarea de BOCHI04R dice "Transvip" |
| 5 | **Nada más cambia** | Recorridos M3 en verde (actualizar los que esperaban el asunto viejo, con nota) |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Asunto: `asuntoYReferencia` / `completarAsunto` en `src/lib/pedidos/armar.ts` y la plantilla `data/plantillas/pedido-proveedor.md`.
- Si algo necesita recarga en la real, dejarlo dicho con el comando (lo corre el owner).

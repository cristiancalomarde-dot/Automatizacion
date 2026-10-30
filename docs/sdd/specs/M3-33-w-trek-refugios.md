# M3-33 · W Trek: los refugios de cada variante en el pedido

**Depende de:** M3-19 (tipo de alojamiento en el trek), M3-21. Pedida por el owner el 2026-10-28 (revisión M3-04,
`docs/sdd/diagnosticos/M3-04-revision-owner.md`); priorizada el 2026-10-29: llegan muchas reservas de W Trek.

Hoy el pedido del W Trek dice el tipo de alojamiento (M3-19: "Alojamiento en el trek: Refugio Dorm a compartir /
Tent DBL / Tent SGL") pero no **dónde** duerme cada noche. Cada variante tiene su recorrido fijo y el proveedor
lo necesita para reservar los refugios o campings.

## El dato (owner 2026-10-28)
| Servicio del catálogo | Productos | Proveedor | Noches en el trek |
|---|---|---|---|
| W Trek Express | CH11, PNTW02 (y dentro de ARCH33EXP) | Las Torres | Central – Francés – Francés (3 noches) |
| W Trek Standard | CH10 (y dentro de los tours con CH10) | Las Torres | Central – Central – Francés – Paine Grande (4 noches) |
| W-Trek Standard with Grey Glacier | PNTW01 | Vértice | Central – Francés – Paine Grande – Grey (4 noches) |

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **La regla en un CSV** (`data/w-trek-refugios.csv`: servicio, refugios en orden, nota con la fuente) con las 3 variantes de arriba. El owner la edita si cambia | El CSV existe con las 3 filas |
| 2 | **El pedido del W Trek suma un renglón** debajo del de M3-19: "Refugios: Central (1 mar) – Francés (2 mar) – Francés (3 mar)" — cada noche con su fecha, calculada desde el inicio del trek en la reserva. Vale igual para refugio o carpa (los campings están en los mismos lugares) | Unitario por variante con fechas: CH11, CH10 y PNTW01 dan el renglón exacto |
| 3 | **Dentro de los tours** (ARCH33, ARCH33EXP, los que incluyen CH10/CH11) sale igual, con las fechas de esa parte del tour | Recorrido: un tour con W Trek arma el pedido a Las Torres con el renglón |
| 4 | **Variante no reconocida:** si el servicio de W Trek no está en el CSV, no se inventa: no sale el renglón y aparece un aviso interno "Refugios del W Trek sin cargar para <servicio>: completarlos a mano" | Unitario |
| 5 | **El CSV viaja a producción** (`outputFileTracingIncludes`; mirar el `.nft.json` de la ruta de pedidos) | Build |
| 6 | **Nada más cambia:** el renglón de M3-19, los demás pedidos y los pedidos en portugués (M3-32) quedan iguales | Recorridos M3-19/M3-21/M3-32 en verde |

## Qué queda afuera
- Elegir otro recorrido que no sea el estándar de la variante (si el pasajero pide otro, se corrige a mano en el
  texto del pedido).
- Pedir comidas o equipo en el trek.

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- El renglón de M3-19: `alojamientoEnElTrek` / `TREK_A_CONFIRMAR` en `src/lib/pedidos/formato.ts` y su uso en
  `src/lib/pedidos/armar.ts`. El servicio se reconoce por `service_provider_nombre` del `producto_servicio`
  (base real 2026-10-29: "W Trek Express", "W Trek Standard", "W-Trek Standard with Grey Glacier 4 nights / 5 days").
  Comparar sin mayúsculas, guiones ni el sufijo "N nights / N days".
- Las fechas: la noche 1 es la fecha de inicio del servicio de W Trek en la reserva; una por noche.

# M3-04 · Prueba con reservas reales y OK del owner

**Depende de:** M3-03

## 1. Qué queremos lograr
Antes de que un pedido llegue a un proveedor de verdad, el owner recibe en su casilla los pedidos
armados desde **reservas reales** de las tres agencias, tal como los recibiría el proveedor. Los
marca "está bien" o "hay que corregir", se ajusta lo que falle (texto, tono, datos, agrupado) y,
con su OK, se prende el envío real.

## 2. Qué hay hoy
- El armado, la pantalla y el envío en modo prueba (M3-01 a M3-03).
- Las reservas reales que trae la lectura diaria de sales@ desde el 2026-10-19, más las de prueba de M2.
- El patrón de revisión del owner de M2-06 ("Está bien" / "Hay que corregir" y la medición).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Configurar operations@ en modo prueba:** el loop principal carga las variables `PEDIDOS_*` en Vercel y en `.env.local` (la clave la pone el owner en el archivo, nunca en el chat), con `PEDIDOS_ENVIO_REAL` apagado | Un envío de prueba desde la app llega a la casilla del owner desde operations@, con "[PRUEBA]" y el proveedor real arriba. En modo prueba no se guarda copia en Enviados y no le llega nada a ningún proveedor |
| 2 | **Revisión de 8 a 10 pedidos reales:** al menos un hotel solo, uno de Iguazú con Cuenca del Plata, un tour compuesto (CHB31 o ARCH31), un Journaway y uno con tareas a mano. El owner marca cada uno "está bien" / "hay que corregir" con qué está mal (destinatario, servicios, fechas, pax, vuelos, tono, firma) | Queda la revisión en `docs/sdd/diagnosticos/M3-04-revision-owner.md` con la cuenta de bien / mal |
| 3 | **Ajustes y nueva vuelta** hasta que el owner no marque errores de datos (destinatario, servicios, fechas, pax). El tono se ajusta en la plantilla | Segunda revisión sin errores de datos |
| 4 | **Prender el envío real solo con el OK del owner:** `PEDIDOS_ENVIO_REAL=si` en Vercel y redeploy. El primer pedido real lo manda una persona del equipo con el owner mirando | El primer envío real llega al proveedor (lo confirma el owner) y aparece en "Enviados" de operations@ |
| 5 | **Volver atrás es inmediato:** sacar `PEDIDOS_ENVIO_REAL` vuelve al modo prueba sin tocar código | Probado antes de prender |

## 5. Qué queda afuera
- Leer o registrar las respuestas de los proveedores (M4).
- Sacar a ccalomarde@ de la copia: se cambia `PEDIDOS_CC` cuando el owner lo pida.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#4** — prender el envío real es una acción hacia afuera que exige el OK explícito del owner.
- **#2** — la clave la carga el owner en el archivo; se pasa a Vercel sin imprimirla.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) la suite completa en verde → 2) envío de prueba real
  contra Ferozo a la casilla del owner (lo corre el loop principal) → 3) el recorrido completo con una
  reserva real: armar, revisar, enviar en modo prueba, y después del OK el primer envío real.
- Esta pieza es sobre todo operación y ajuste; los cambios de código que salgan de la revisión son
  chicos (plantilla, agrupado, datos) y cada uno con su test.

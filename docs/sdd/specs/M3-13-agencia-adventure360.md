# M3-13 · Agencia Adventure360 (BRARCH26) y las opciones del pasajero en Buenos Aires y Mendoza

**Depende de:** M2-01 (agencias), M2-03 (reconocer el producto), M3-01 (armado). Pedida por el owner el
2026-10-22: Adventure360 volvió a reservar (mail del 15/10, cayó en spam de operaciones3@; desde ahora escribe a
sales@). Vende solo BRARCH26 ("From Rio de Janeiro to Santiago de Chile"), ya en el catálogo.

## 1. Qué queremos lograr
Que una reserva de Adventure360 entre sola como BRARCH26, con la opción de tour que eligió el pasajero, y que
sus pedidos salgan bien.

Ejemplo real (`Insumos/Mails/Reserva de pedido de Cliente Adventure360 Ejemplo Rio de Janeiro to Santiago 15 oct 26.docx`):
remitente `bookings@adventure360.com`, texto plano con `First name`, `Last name`, `Date of birth`,
`Nationality`, `Passport number`, `Telephone number`, `Tour: Rio de Janeiro to Santiago`, `Arrival date`,
`Arrival flight details for the airport pick up`, `Choice of tour in Buenos Aires: bike tour`,
`Choice of tour in Mendoza: rafting`, `Type of accommodation selected: Hostel Dorm`.

## 2. Respuestas del owner (2026-10-22)
1. **Buenos Aires:** si eligen **bike tour**, se reserva el Bike Tour (La Bicicleta Naranja) y **no** el City
   Tour. El pasajero tiene la opción; si no eligió o eligió city tour, va el City Tour como hoy.
2. **Mendoza:** si eligen **rafting**, **no** se reserva Alta Montaña: a **Huentata** se le pide **solo Bodegas**
   y a **Kahuak** el **rafting** (Kahuak está en el Excel de proveedores, fila 196: reservas@kahuak.com.ar,
   agencias@kahuak.com.ar, receptivo@kahuak.com.ar, "rafting y cabalgata").
3. **Fecha:** una reserva de catálogo no puede venir sin fecha. Si viene "TBC" (muy raro, error de la vendedora),
   queda **para revisión** con el motivo "falta la fecha de inicio: preguntársela a la agencia"; se corrige
   después con "Corregir" (M3-07).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Adventure360 es una agencia conocida: `adventure360.com` en `data/agencias.csv` (con nota del owner) | Unitario: `bookings@adventure360.com` → Adventure360 |
| 2 | "Rio de Janeiro to Santiago" (Adventure360) se reconoce como BRARCH26, declarado en un archivo de datos con nota (como los códigos de Kilroy/TourRadar), cargado a `codigo_externo` por un importador re-ejecutable | Unitario + integración (base de pruebas): el emparejado da BRARCH26 |
| 3 | La lectura del mail (IA) toma los datos del ejemplo, incluidas las elecciones de tour y la habitación ("Hostel Dorm") | Eval/fixture con el mail de ejemplo (IA falsa en los tests, como el resto) |
| 4 | Opciones del pasajero como regla de datos (archivo nuevo en `data/`, sin casos especiales en código): en OD018 "bike" → Bike Tour en lugar de City Tour; en OD019 "rafting" → Huentata solo Bodegas + Kahuak rafting. Vale para cualquier agencia que mande esa elección, dentro de BRARCH26 o suelto | Unitario (`armarPedidos`): bike → pedido a La Bicicleta Naranja y nada de City Tour a Grupo Summa; rafting → Huentata con "Bodegas" (sin Alta Montaña) y Kahuak con "Rafting" con su fecha; sin elección → como hoy |
| 5 | Sin fecha de inicio ("TBC") → para revisión con el motivo de §2.3 | Unitario/integración |
| 6 | Recorrido: el mail de ejemplo (con una fecha) entra por M2 en modo prueba, queda recibido como BRARCH26 y arma sus pedidos con bike tour y rafting | Integración en la base de pruebas |
| 7 | Lo que ya estaba no cambia | Suite existente en verde |

## 4. Qué ve el usuario
Sin pantallas nuevas: las reservas de Adventure360 aparecen en la lista como cualquier otra agencia, y en
"Armar pedidos" salen Bike Tour / Kahuak cuando el pasajero los eligió.

## 5. Qué queda afuera
- Que la categoría del tour elija el hotel de cada parte (hueco conocido de BRARCH26/ARCH33/ARBR23).
- Leer la casilla operaciones3@ (Adventure360 ya escribe a sales@).

## 6. Reglas del proyecto que toca
- **#4:** nada se carga en la base **real** sin el OK del owner; la carga (códigos y lo que haga falta del
  catálogo) la corre el owner con `!`.
- **#3:** la lectura usa la IA existente con su techo de gasto; el emparejado y las opciones son determinísticos.
- **#5:** terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)
- Seguir la forma de `data/codigos-kilroy.csv` / `importar:codigos-kilroy` para el nombre de Adventure360 (o
  generalizar a un archivo de códigos por agencia si es más simple), y de `data/dias-servicio.csv` /
  `hostel-segun-habitacion.csv` para las opciones (leídas al armar, sin recarga si se puede).
- El rafting de Kahuak no está en el catálogo de OD019: si hace falta un servicio nuevo, usar el mecanismo de
  M3-10 (`data/renglones-agregados.csv`) y dejar listo el comando de carga para la real.
- Dónde viaja la elección: ver cómo la lectura guarda `pedidos_especiales`/notas; preferir un campo explícito
  si es simple.
- Base de pruebas: `.env.pruebas.local` (guard `src/lib/entorno/base-de-pruebas.ts`). Nunca la real.

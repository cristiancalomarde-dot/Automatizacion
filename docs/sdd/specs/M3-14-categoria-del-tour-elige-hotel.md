# M3-14 · En los tours, la categoría vendida elige el hotel de cada parte

**Depende de:** M1-05 (categorías tour ↔ paquete), M3-01 (armado). Pedida por el owner el 2026-10-22 (regla
repetida desde M1-05; ver DECISIONS 2026-10-05/06 y `data/categorias-tour.csv`).

## 1. Qué queremos lograr
En los tours largos la categoría se llama "Budget Hotel" para no generar expectativas. Al armar los pedidos:
- **Donde el componente tiene Budget Hotel, se usa Budget Hotel.**
- **Donde no tiene, se usa el siguiente: Hotel 3\*** (ej. Iguazú OD010A → El Pueblito / Botánica).
- Si `data/categorias-tour.csv` dice otra cosa para ese tour y componente, manda el archivo (ej. Río OD032:
  Budget del tour = Hotel 3\* del paquete, Nacional Inn Copacabana / Copacabana Mar).
- Las demás categorías (Hostel, Hotel 3\*, Hotel 4\*, "Hotel in SPA") siguen como el archivo o iguales.

## 2. Qué hay hoy
`armar.ts` `nivelElegido()` busca el nivel de la habitación ("Budget Hotel") tal cual en cada componente; si el
componente no lo tiene, deja la tarea "Elegir el hotel de <código>…" y el pedido de Iguazú dentro de BRARCH26
sale "alojamiento a confirmar". `data/categorias-tour.csv` solo lo usa el importador de tours para controlar.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Al armar un componente de un tour, el nivel = la equivalencia de `data/categorias-tour.csv` (tour, categoría, componente) si existe; si no, el mismo nivel si el componente lo tiene; si no y es Budget Hotel, Hotel 3\* | Unitario: BRARCH26 "Budget Hotel" → OD010A pide El Pueblito; OD032 Nacional Inn; un componente con Budget propio pide su Budget |
| 2 | Las estadías "a confirmar" que se informan a otros proveedores (pick ups, Iguazú de M3-12) usan el mismo hotel | Unitario: el pedido a Cuenca del Plata de BRARCH26 Budget dice El Pueblito |
| 3 | Desaparecen las tareas "Elegir el hotel de…" que esto resuelve (ARCH33, ARCH33EXP, BRARCH26, ARBR23, 5C01) | Unitario/integración: armar cada tour con su categoría sin esa tarea |
| 4 | Un paquete suelto (no tour) no cambia | Tests existentes en verde |

## 4. Qué ve el usuario
Sin pantallas nuevas: los pedidos de los tours salen con el hotel de la categoría. "Volver a armar" actualiza
los borradores sin editar.

## 5. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde.
- **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- Leer `data/categorias-tour.csv` al armar (como `dias-servicio.csv`), o desde la base si el importador ya lo
  guardó; reusar `normalizarCategoria` de `src/lib/importador-tours/rutas.ts`.
- La regla Budget → Hotel 3\* es la general (owner); el archivo la sobreescribe por componente.
- No romper M3-11 (`opcionesDe`), M3-12 (`paqueteConTraslados`) ni M3-13.
- Base de pruebas: `.env.pruebas.local`. Nunca la real.

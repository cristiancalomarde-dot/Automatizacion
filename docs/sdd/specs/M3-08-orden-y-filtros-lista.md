# M3-08 · Orden y filtros de la lista de reservas, y viajes terminados solo para el owner

**Depende de:** M2-05 (lista) y M3-06 (filtro por responsable). Pedido por el owner el 2026-10-20.

## 1. Qué queremos lograr
La lista de reservas se abre **ordenada por inicio del viaje, las próximas primero**, con todas las
reservas vigentes (recibidas, para revisión, pedidas, confirmadas, etc.). Cada uno puede elegir otro orden
y filtrar por agencia y por fechas del viaje. Los **viajes ya terminados** no aparecen para el equipo; solo
el owner los ve, para el control de liquidaciones (las liquidaciones se mandan a las agencias cuando el
pasajero ya viajó).

## 2. Qué hay hoy
- **La lista** (`src/components/reservas/lista-reservas-pantalla.tsx`, `src/lib/reservas/consultas.ts`)
  trae todas las reservas ordenadas por llegada del mail (`created_at` desc), con buscador, filtro de
  estado, filtro por responsable (M3-06) y "ver de prueba".
- **Roles:** `usuario.rol` solo admite `operador` (`supabase/migrations/0001_usuario.sql`); no hay rol de
  administrador.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **"Ordenar por":** "Inicio del viaje" (por defecto, las próximas primero), "Fin del viaje" y "Llegada del mail (más nuevas)". Las reservas sin fecha de inicio van al final | Test: el orden por defecto es por inicio ascendente; cambiar el orden reordena |
| 2 | **Todas las vigentes juntas:** por defecto se ven todos los estados (recibida, para revisión, pedido a proveedor, confirmada, etc.), salvo descartadas. El filtro de estado que ya existe sigue funcionando | Test: una confirmada y una pendiente aparecen juntas, en orden de inicio |
| 3 | **Filtro por agencia:** Todas, Kilroy, Journaway, TourRadar (las de `data/agencias.csv`) | Test |
| 4 | **Filtro por fechas del viaje:** "Arrancan en los próximos 7 / 30 días", "Viajan en <mes>" (elegir mes y año) y "Todas las fechas". Un viaje "viaja en marzo" si alguno de sus días cae en marzo | Test con viajes que cruzan de mes |
| 5 | **Viajes terminados ocultos para el equipo:** una reserva cuyo fin de viaje ya pasó (fecha_fin < hoy, hora Argentina) no aparece en la lista de un operador. **No debe pasar:** que un operador pueda verlas desde la lista cambiando un filtro | Integración: un operador no recibe las terminadas desde el servidor, no solo ocultas en pantalla |
| 6 | **El owner las ve:** las personas administradoras (lista en la variable de entorno `ADMINS_EMAILS`, separada por comas; hoy la del owner) tienen además el filtro "Viajes terminados", que muestra solo esas, ordenadas por fin del viaje (las más recientes primero) y combinable con agencia y mes, para armar las liquidaciones | Test: con un mail administrador aparece el filtro y trae las terminadas; con un operador, el filtro no aparece y la consulta no las trae |
| 7 | **Se recuerda la elección** (orden y filtros) por persona en el navegador, como el filtro de responsable | Test |
| 8 | **Contador:** "Mostrando N reservas" según los filtros | Test |

## 4. Qué ve el usuario
- Arriba de la lista: "Ordenar por: Inicio del viaje ▾", "Agencia ▾", "Fechas del viaje ▾", el filtro de
  estado y el de responsable que ya están, y el buscador.
- Solo el owner: una opción más, "Viajes terminados (para liquidaciones)".
- Vacío: "No hay reservas con estos filtros" con "Limpiar filtros".

## 5. Qué queda afuera
- Marcar una reserva como "liquidada" o armar el mail de la liquidación (se puede pedir después).
- Bloquear el detalle de una reserva terminada por enlace directo: el detalle sigue abierto para el equipo
  (para responder consultas puntuales); lo que se oculta es la lista.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#2:** `ADMINS_EMAILS` vive en variables de entorno (Vercel y `.env.local`), documentada en
  `.env.example` sin valores.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + pantalla + lint + tipos + build → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; guard `src/lib/entorno/base-de-pruebas.ts`) → 3)
  recorrido con pantallas reales y dos sesiones de prueba (una administradora y una operadora), como
  M3-06. **Nunca** se escribe en la base real.
- **El filtro de terminadas va del lado del servidor** (la consulta de la lista para un operador excluye
  `fecha_fin < hoy`). Si el patrón actual carga la lista desde el navegador, pasá esa consulta por una
  server action o una función de la base que decida según el mail de la sesión y `ADMINS_EMAILS`; no
  alcanza con esconderlo en la pantalla. Si hace falta una migración (`0023_…sql`), aplicala **solo** a la
  base de pruebas con `--db-url` (`supabase/.temp/project-ref` apunta a la real).
- **Test primero.** Textos en `src/lib/textos/`. Reusar los filtros y el recuerdo por persona de M3-06.

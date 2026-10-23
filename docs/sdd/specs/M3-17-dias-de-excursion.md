# M3-17 · Excursiones con día fijo en todos los destinos cargados

**Depende de:** M3-15 (`data/dias-servicio.csv` con regla por nombre de servicio). Pedida por el owner el 2026-10-23
(feedback de operaciones, G3; validado 1 a 1: `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
Hoy muchas excursiones salen "Fecha: a coordinar (estadía del … al …)". Ej. DK1592913: Torres del Paine Full Day de
Patagonia Planet. La regla del owner: cada excursión va un día fijo de la estadía en ese destino (salvo cambio a mano),
también dentro de los tours. Días validados por el owner (día = día de la estadía en ese destino, el 1 es el de llegada):

| Componente | Excursión (proveedor) | Día |
|---|---|---|
| OD017 Puerto Natales | Torres del Paine Full Day from Puerto Natales (Patagonia Planet) | 2 |
| OD032 Río | Big Dude (Local 55) | 2 |
| OD025 Puerto Madryn | Peninsula Valdes Full Day (All Peninsula) | 2 |
| OD013 El Calafate + TdP | Torres del Paine Full Day from El Calafate (South Road) | 3 |
| OD018 Buenos Aires | Tango Show with dinner, drinks and transfers (Madero Tango) | 3 (de noche) |
| OD020 Buenos Aires + Uruguay | Colonia Day Trip Circuito Historico (Buquebus) | 3 |
| OD022 Ushuaia | Beagle Channel Boat Trip (Rumbo Sur) | 2 |
| OD022 Ushuaia | Tierra del Fuego National Park half Day (Rumbo Sur) | 3 |
| OD029 Santiago | Bike Tour (Bicicleta Verde) | 2 |
| OD010A-D / OD011 Iguazú | Cataratas lado argentino | 2 |
| OD010A-D / OD011 Iguazú | Cataratas lado brasileño | 3 |

Ya fijados (no cambian): OD030 géiseres día 3, OD031 Tiwanaco día 2, Perito Moreno, OD014, AR34, OD019, City/Bike Tour
BUE día 2, OD040 City Tour MVD día 2. **OD037** (Río, no cargado) queda para cuando se cargue: tour de Río día 2,
Angra dos Reis e Ilha Grande día 3 — anotarlo, no construir.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Las filas nuevas en `data/dias-servicio.csv`, cada una con su nota del owner (2026-10-23) | Test de datos (`dias-servicio-datos.test.ts`): cada componente/excursión de la tabla tiene su día |
| 2 | El pedido sale con la fecha (llegada + día − 1) en vez de "a coordinar", sin aviso de fecha | Unitario: OD017 llegada 16 mar → Torres del Paine 17 mar; OD022 llegada 1 → Beagle 2, PN 3 |
| 3 | Tango con momento "por la noche" (como Bodegas "por la tarde") | Unitario |
| 4 | Iguazú: dentro del receptivo 105 Premium (Cuenca del Plata), lado argentino día 2 y lado brasileño día 3; en el combinado (OD010D) respetar lo que hoy arma el cruce si ya fija otra cosa, y avisarlo en el reporte | Unitario sobre OD010A/B y OD010D |
| 5 | Vale dentro de los tours, contando desde el inicio de ese componente (ej. OD017 dentro de ARCH31, OD025/OD013/OD022 dentro de AR09, OD032/OD029 dentro de BRARCH26) | Unitario/integración: ARCH31 o DK1592913, AR09 |
| 6 | Si la estadía es más corta que el día pedido (ej. el componente tiene 2 noches y la regla dice día 3), no inventa: queda "a coordinar" con aviso como hoy | Unitario |
| 7 | Nada más cambia | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: los pedidos de excursión salen con fecha. "Volver a armar" actualiza los borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- `data/dias-servicio.csv`: `codigo,orden,dia,servicio,momento,nota`. `orden` = el orden del servicio en el producto;
  buscarlo en el catálogo (base de pruebas / fixtures, o `docs/sdd/diagnosticos/M1-04d-carga.md` para los nombres).
  Cuando dos excursiones comparten `orden` (o un renglón junta varias, como Iguazú), usar la columna `servicio`
  como en M3-15.
- Iguazú: mirar cómo M3-12 arma el pedido a Cuenca del Plata (cada excursión con el hotel de esa noche) y el cruce
  en los combinados. Lo más simple que deje la regla en datos.
- Si un componente de la tabla no aparece cargado o el nombre no calza, no lo inventes: reportalo.
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.

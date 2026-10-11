# M1-10 · Motivos de los ajustes en voz de la app, sin notas internas

**Depende de:** M1-09

## 1. Qué queremos lograr
Que el operativo que abre un tour vea por qué un traslado no se pide o cambió, en una frase clara.
Hoy ve notas internas de trabajo ("Owner (2026-10-10): … es M2"), y eso hace que la app parezca un
prototipo. La auditoría de marca previa al deploy lo marcó como lo único que bloquea publicar.

## 2. Qué hay hoy
- `data/traslados-tour.csv` (columna `nota`) y `data/servicios-a-pedido.csv` (columna `nota`)
  guardan el registro interno de la decisión del owner. Esa misma nota se muestra en pantalla:
  - como `ajuste.motivo` en `src/components/catalogo/servicios.tsx:89`;
  - como `aPedidoNota` en `servicios.tsx:92`.
- Cuando una excepción no tiene nota, el motivo por defecto es "excepción del owner
  (data/traslados-tour.csv)" (`src/lib/importador-tours/traslados.ts:193`).
- Los motivos de la regla general ("llega en bus desde Uyuni") empiezan en minúscula y no tienen
  punto final (`traslados.ts:136-137`).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Los dos CSV tienen una columna nueva, **`motivo`**: el texto que ve el operativo. `nota` queda como registro interno y **no se muestra nunca**. En los dos archivos, `motivo` es obligatorio: una fila sin `motivo` hace fallar el importador con un mensaje claro | Unitario: parseo con `motivo`. Si falta, da error con el número de fila. El archivo real tiene `motivo` en todas las filas y ningún `motivo` contiene "Owner", "M2", "M3", "data/" ni una fecha |
| 2 | Textos de `motivo` (usar estos tal cual) | Ver la tabla de abajo |
| 3 | No hay motivo por defecto que exponga rutas ni roles internos. Si igual hace falta uno, va en `TEXTOS`, por ejemplo "Ajuste definido para este tour." | Grep: en `src/` no queda "excepción del owner" ni "data/traslados-tour.csv" en textos de interfaz |
| 4 | Los motivos que arma la regla general empiezan con mayúscula y terminan en punto. Ejemplos: "Llega en bus desde Uyuni.", "Llega en bus desde Uyuni y sale en bus a La Paz." | Unitario de `traslados.ts`. El reporte `M1-08-traslados.md` queda regenerado y coherente |
| 5 | La pantalla muestra `motivo` y nunca `nota` | Test de pantalla: en 5C01, BRARCH26, BOCHI04R, ARCH31 y OD019, el texto visible no contiene "Owner", "M2" ni "(2026-". Recorrido de integración con la base real recargada |

**Textos de `motivo`:**

| Archivo | Tour / paquete / servicio | motivo |
|---|---|---|
| traslados-tour | 5C01 · OD029 · SCL - accommodation | Hoy no se pide este traslado en el tour. |
| traslados-tour | BRARCH26 · OD029 · SCL - accommodation | Hoy no se pide este traslado en el tour. |
| traslados-tour | 5C01 · OD010D · 105 Premium x Foz | Llega en bus a Foz y sigue en bus desde Puerto Iguazú. |
| traslados-tour | BRARCH26 · OD010A · 105 Premium | Llega en bus a Foz y sigue en bus desde Puerto Iguazú. |
| traslados-tour | 5C01 · OD031 · La Paz Airport - La Paz Accommodation | Llega en bus desde Uyuni: el traslado es desde la terminal de buses. |
| traslados-tour | BOCHI04R · OD030 · in CJC - Accommodation in San Pedro | En este tour el traslado es de salida, de San Pedro al aeropuerto de Calama. |
| traslados-tour | 5C01 · COMPCH01 · Santiago - Valparaiso - Santiago | Solo ida: desde Valparaíso el tour sigue en bus a Calama. |
| traslados-tour | ARCH31 · OD017 · Punta Arenas - Puerto Natales | Llega a Puerto Natales en bus desde El Calafate. |
| servicios-a-pedido | OD019 · Remis Mendoza | Solo si el paquete se vende con traslados (el pasajero llega en avión). |

## 4. Qué ve el usuario
- **Pantalla que cambia:** detalle de producto (`/catalogo/[id]`). Cambia solo el texto del
  motivo junto a las etiquetas "No se pide en este tour", "Cambiado en este tour", "Solo llegada"
  y "Según la reserva".
- **Estados:** sin cambios.

## 5. Qué queda afuera
- El resto de los hallazgos menores de la auditoría (color de chips, ámbar, chip de proveedor en
  filas anuladas, "Solo ida" para buses, columna Origen). Quedan anotados en `PROGRESS.md`.
- Publicar: lo hace el loop principal después, con el OK del owner que ya está dado.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)
- **Las 3 verificaciones, en orden:**
  1. Unitarios + lint + tipos.
  2. Integración contra Supabase real: recarga `importar:paquetes` → `importar:tours` y suite
     completa.
  3. Recorrido de pantalla + `npm run build`.
- **Build:** NO correr `npm run build` sobre el `.next` del clon, porque traba el `next dev` de
  :3000. Hacerlo en un `git worktree` aparte con su propio `npm ci` y borrarlo al terminar.
- **Dónde guardar el motivo:**
  - Ajustes: hoy `tour_servicio_ajuste.motivo` se llena con la nota. Pasa a llenarse con `motivo`.
    La nota, si se quiere conservar, va solo al reporte.
  - `a_pedido_nota`: se llena con `motivo`.
  - No hace falta migración.
- No commitear `CLAUDE.md`. Nunca usar `git commit -a`. Sin push. No tocar la tabla del plan ni
  `PROGRESS.md`. Usar timeouts en los comandos largos y commitear de a pasos.

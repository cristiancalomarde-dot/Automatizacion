# M1-03 · Importador: directorio de proveedores

**Depende de:** M1-02 (necesita la tabla `proveedor` e `importacion` ya creadas).

## 1. Qué queremos lograr

Un importador que lee entero `Insumos/Proveedores Hi Travel 2026 para IA.xlsx` (hoja "Contactos
hi") y carga la tabla `proveedor`: nombre normalizado, destino/categoría, mail (o mails) o canal
WhatsApp, y aclaraciones — sin inventar datos y sin descartar proveedores que no tienen mail
reconocible. Es la pieza que hace real el riesgo #3 del PRD ("el directorio no está listo a
tiempo"): al terminar esta spec, HI Travel tiene sus ~200 proveedores en el sistema, listos para
que M1-04/M1-05 los asocien a productos y M3 les escriba.

## 2. Qué hay hoy

- El archivo `Insumos/Proveedores Hi Travel 2026 para IA.xlsx`, hoja "Contactos hi", con ~200 filas
  de proveedores. No está cargado en ningún sistema — hoy se consulta a mano.
- Formato real de la hoja: bloques por destino (una fila con el nombre del destino en mayúsculas,
  ej. `BUENOS AIRES`, `IGUAZU`, `BARILOCHE`, `SANTIAGO`, `BRASIL`, `BOLIVIA`, `URUGUAY`,
  `RENT A CAR`); debajo, una fila de encabezado (`CATEGORIAS, PROVEEDOR, Mail/web, Aclaraciones,
  Nro para el voucher`, a veces con `DESTINO` en la primera columna en vez de vacía); después, una
  fila por proveedor agrupada por categoría (Hotel, Hostel, Apart Hotel, Posada, Hostal,
  EXCURSIONES, TRANSFER, RENT A CAR...).
- La columna "Mail/web" es sucia: a veces trae más de un mail separado por `//` o coma; a veces un
  link a una web en vez de mail; a veces texto tipo "WPP", "Por wsp", "Solo WPP"; a veces
  `#ERROR!` (celda rota del Excel original); a veces queda vacía.
- Las tablas `proveedor` e `importacion` existen (creadas en M1-02) pero están vacías. No hay
  importador todavía.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Lee el archivo completo, recorriendo cada bloque de destino y su fila de encabezado, sin saltear ninguno. | Al correr el importador sobre el Excel real, la cantidad de proveedores cargados en la tabla `proveedor` está entre 180 y 220 (el orden de magnitud de las ~200 filas reales de la hoja). |
| 2 | Detecta el destino (fila-bloque en mayúsculas) y la categoría (columna `CATEGORIAS`) de cada proveedor y los guarda junto al registro. | Un proveedor del bloque `IGUAZU` con categoría `Hostel` en el Excel queda cargado con ese destino y esa categoría (consultando el registro se ve `IGUAZU` / `Hostel`, no otro valor ni vacío). |
| 3 | Normaliza el nombre del proveedor (`nombre_normalizado`): recorta espacios, unifica mayúsculas/minúsculas y espacios repetidos, para que variantes de escritura del mismo proveedor no generen registros duplicados. | Si el mismo proveedor aparece escrito con variaciones de mayúsculas o espacios dentro del mismo destino (ej. "Cuenca del Plata" y "CUENCA DEL PLATA "), el importador carga o actualiza **un solo** registro, no dos. |
| 4 | Detecta un mail simple en la columna "Mail/web" y lo guarda. | El proveedor "Milhouse Avenue Hostel" queda cargado con el mail `melina@milhousehostel.com`, canal `mail`. |
| 5 | Cuando la celda trae más de un mail (separados por `//` o coma), guarda todos, no solo el primero. | Un proveedor cuya celda "Mail/web" tiene dos mails separados por `//` (o coma) queda cargado con ambos mails guardados, ninguno perdido. |
| 6 | Reconoce cuando el dato es "solo WhatsApp" (la celda contiene texto tipo "WPP" o "wsp", en cualquier variación de mayúsculas o rodeado de otro texto como "Solo WPP" / "Por wsp") y marca `canal: whatsapp` en vez de `mail`. | El proveedor "Hostel Lagares Mendoza" (celda con "WPP") queda cargado con `canal: whatsapp` y **sin** ningún mail cargado. |
| 7 | Cuando la celda trae un link a una web (no un mail), no lo guarda como si fuera un mail. | Un proveedor cuya celda "Mail/web" es una URL (no contiene `@`) no queda con un mail inventado a partir del link; el link original se conserva en `aclaraciones` para referencia humana y el proveedor queda "sin mail". |
| 8 | Cuando la celda es `#ERROR!` o está vacía y no hay señal de WhatsApp, el proveedor se carga igual (nombre, categoría, destino) marcado "sin mail" — nunca se descarta la fila ni se inventa un mail. | Un proveedor con celda `#ERROR!` (o vacía) queda presente en la tabla `proveedor` con nombre, categoría y destino correctos, sin mail y sin canal `whatsapp`; **no** aparece ningún mail inventado en su registro (prueba de lo que NO debe pasar). |
| 9 | Para los casos ambiguos que las reglas de los puntos 4-8 no puedan resolver con una regla simple, pide una segunda lectura a la IA de `integraciones-ia.md` (no a todo el archivo) — y respeta el techo de gasto de la regla #3. Si la IA tampoco resuelve con confianza, el proveedor queda igual "sin mail", nunca se inventa un mail. | Sobre el conjunto de filas ambiguas del Excel real (texto mixto que no calza con las reglas 4-8), el importador llama a la IA solo para esas filas (se puede ver en los logs/contador de uso que la cantidad de llamadas es muchísimo menor a las ~200 filas totales), y ninguna fila termina con un mail inventado que no esté en el Excel. |
| 10 | Registra la corrida en `importacion`: qué archivo, cuándo, cuántos proveedores se procesaron y cuántos quedaron "sin mail". | Después de correr el importador, `importacion` tiene una fila nueva con el nombre del archivo, la fecha/hora, el total de proveedores procesados y el total "sin mail", y esos totales coinciden con lo observado en `proveedor`. |
| 11 | Es re-ejecutable: correr el importador de nuevo con el mismo archivo actualiza los proveedores existentes en vez de duplicarlos. | Correr el importador dos veces seguidas sobre el mismo Excel deja la misma cantidad de filas en `proveedor` después de la segunda corrida que después de la primera (no se duplica ningún proveedor), y `importacion` sí registra una segunda fila de corrida. |

## 5. Qué queda afuera

- **La pantalla de Directorio** que muestra este listado y permite corregir "sin mail" a mano — es
  M1-06.
- **Una pantalla para subir/resubir el Excel** — para esta carga el equipo de construcción corre el
  importador directo con el archivo de `Insumos/` (`m1-catalogo-y-proveedores.md` §2). Resubir
  cuando el owner actualice el Excel queda para un milestone posterior.
- **La columna "Nro para el voucher"** de la hoja — es un dato de voucher/servicio, no del
  proveedor; no se carga en esta spec.
- **Teléfono estructurado** — la hoja "Contactos hi" no trae una columna de teléfono separada; si no
  hay un teléfono identificable en la fila, el campo queda vacío (no se inventa ni se extrae del
  texto de "Aclaraciones").
- **Fusionar proveedores que aparecen en más de un destino** (ej. una transportadora que opera en
  varias ciudades, cada una con su propia fila-bloque) — cada fila de destino distinta genera o
  actualiza su propio registro de `proveedor`; no se intenta reconocer que dos filas en destinos
  distintos son "la misma empresa". Si en la práctica esto genera duplicados reales de una misma
  empresa, se ajusta al ver los datos cargados (no bloquea esta spec).
- **Asociar proveedores a productos** (`producto_servicio`) — eso lo hacen M1-04 y M1-05 al cargar
  el catálogo.

## 6. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#3** — la IA solo entra como respaldo para las filas ambiguas de la columna 9 de la tabla de
  arriba, nunca para todo el archivo; corre bajo el mismo techo de US$ 20/mes de
  `integraciones-ia.md` (chequeo de gasto antes de cada llamada, corte a "sin mail" si se agota).

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios (parseo de una celda: mail
  simple, múltiples mails, WPP/wsp, link a web, `#ERROR!`, vacía; normalización de nombre) +
  linter → 2) integración: correr el importador contra el Excel real de `Insumos/` y verificar los
  puntos 1, 2, 8, 10 y 11 de la tabla de §3 contra la base → 3) recorrido completo: correr el
  importador de punta a punta sobre el archivo real y confirmar en la base los casos concretos de
  los puntos 4, 5, 6 y 9. No se avanza a una capa con la anterior en rojo.
- **Test primero:** escribir el test de parseo de celda (mail simple, múltiples mails, WPP,
  `#ERROR!`/vacía, link a web) y verlo fallar antes de escribir el parser.
- **Reglas simples antes que IA (orden de resolución por celda):**
  1. Vacía o `#ERROR!` → sin mail, sin canal whatsapp (categoría "no reconocible por regla simple,
     tampoco es ambigua" — no llama a la IA, es un caso limpio de "no hay dato").
  2. Contiene `@` → extraer todos los mails separados por `//` o `,`/`;`, canal `mail`.
  3. No contiene `@` pero sí "wpp" o "wsp" (case-insensitive, en cualquier posición del texto) →
     canal `whatsapp`, sin mail.
  4. No contiene `@` pero sí un patrón de URL (`http`, `www.`, o un dominio reconocible) → sin mail,
     guardar el texto original en `aclaraciones`, sin canal whatsapp.
  5. Cualquier otro texto no vacío que no calce con 1-4 (ambiguo) → respaldo de IA
     (`integraciones-ia.md`): se le pasa el texto de la celda y de "Aclaraciones" y se le pide
     devolver mail(s) o canal, con confianza; por debajo del umbral de confianza, cae a "sin mail"
     igual que el caso 1. Se llama celda por celda, no el archivo entero de una vez, así el conteo
     de llamadas queda acotado a lo realmente ambiguo.
- **Normalización de nombre:** `trim`, colapsar espacios múltiples, comparación case-insensitive
  para decidir si dos filas son "el mismo proveedor" dentro del mismo destino; `nombre_normalizado`
  guarda la forma canónica (ej. minúsculas sin espacios extra) usada para el emparejado.
- **Clave de re-ejecución (idempotencia):** upsert por `nombre_normalizado` + destino — si ya existe
  un proveedor con esa combinación, se actualiza (mail/canal/aclaraciones/categoría) en vez de
  insertar uno nuevo.
- **Categoría y destino en el modelo:** `modelo-de-datos.md` no define un campo dedicado de
  "categoría" para `proveedor` (sí "país/ciudad"). Si M1-02 no agregó un campo propio para la
  categoría del Excel (Hotel/Hostel/Excursión/Transfer/Rent a Car...), se guarda en `aclaraciones`
  junto con el resto del texto original de esa columna, dejando claro en el código qué parte es
  categoría y qué parte es la aclaración original — no se inventa un campo nuevo por fuera de lo
  que M1-02 dejó creado.
- **Entregables:** el script o endpoint admin del importador (ej.
  `scripts/importar-proveedores.ts` o `app/api/admin/importar-proveedores/route.ts` — a elección
  de quien construye, dado que no es pantalla pública en esta spec) que lee
  `Insumos/Proveedores Hi Travel 2026 para IA.xlsx` con SheetJS del lado del servidor
  (`stack.md`), sus tests, y la corrida real que deja `proveedor` e `importacion` pobladas. Usa el
  cliente de Supabase con la clave de servidor (nunca expuesta al navegador, regla #2).
- **Diseño y alcance no se deciden acá:** el esquema exacto de columnas de `proveedor` es el que
  fijó M1-02; el detalle de reglas de IA y su techo de gasto vive en `integraciones-ia.md`.

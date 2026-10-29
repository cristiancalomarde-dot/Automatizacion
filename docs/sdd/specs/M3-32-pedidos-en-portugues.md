# M3-32 · Pedidos en portugués a los proveedores de Brasil

**Depende de:** M3-28 (textos de los pedidos), M3-34, M3-35, M3-36. Pedida por el owner el 2026-10-28 (staff,
DK1592913 y DK1597924: "no les gusta que les hablemos en castellano"). Priorizada el 2026-10-29: hay muchas
reservas a Brasil.

Hoy todo pedido sale en castellano. Los proveedores de Brasil (Bambu Hostel en Foz, las pousadas de Paraty e
Ilha Grande, los hoteles de Río…) tienen que recibirlo en **portugués de Brasil**, con el mismo tono cordial.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Quién es de Brasil:** el proveedor cuya `ciudad` en el directorio es de Brasil. Lista en `data/ciudades-portugues.csv` (ciudad, nota): BRASIL, FOZ DO IGUAZU / FOZ DO IGUAÇU, RIO DE JANEIRO, ILHA GRANDE, PARATY, SALVADOR, BONITO, PANTANAL, CHAPADA DIAMANTINA, LENÇÓIS, LENÇÓIS MARANHENSES, PRAIA DO FORTE, FORTALEZA, MANAUS / MANAOS, SAO PAULO, BUZIOS. Se compara sin mayúsculas ni acentos. El owner suma ciudades editando el CSV | Unitario: Bambu hostel (FOZ DO IGUAZU) → portugués; Pousada Dom Angelo (PARATY) → portugués; Cuenca del Plata (Puerto Iguazú) → castellano; un proveedor sin ciudad → castellano |
| 2 | **Plantilla en portugués:** `data/plantillas/pedido-proveedor-pt.md`, mismo formato y los mismos `{{…}}` que la de castellano. Asunto "Solicitação de reserva – {{pasajero}} x {{pax}} – {{fechas}}"; cuerpo cordial ("Olá! Tudo bem? Esperamos que sim." … "Muito obrigado!"); **la firma es la misma** que en castellano | El pedido a Bambu sale con el asunto y el cuerpo de la plantilla pt; la firma igual |
| 3 | **Los renglones armados también en portugués:** fechas ("1 fev 2027", "de 30 jan a 2 fev 2027"), noches, la habitación ("DBL Standard com café da manhã", "quarto compartilhado (dorm), com café da manhã", "a confirmar (dorm / DBL / SGL)"; sin desayuno de M3-35 → sin "com café da manhã"), pick up / drop off, "voo a confirmar", la línea de pasajeros ("PAX 1: … · Nacionalidade · Data de nascimento · Passaporte: pendente"), el renglón de horario de M3-34 ("Vocês podem nos confirmar o horário do passeio/dos passeios, por favor?") y lo pendiente | Unitario por cada renglón con su texto exacto en pt; el mismo pedido en castellano sigue idéntico al de hoy |
| 4 | **Lo interno sigue en castellano:** la pantalla, los avisos amarillos, las tareas a mano y los motivos de revisión no cambian. Los avisos que van dentro del mail al proveedor (ej. el del cruce de M3-36, si va en el pedido a un proveedor de Brasil) sí van en pt | Unitario/recorrido: la pantalla de pedidos muestra los textos internos en castellano |
| 5 | **En la pantalla se ve el idioma:** la tarjeta del pedido dice "En portugués" junto al destinatario, para que el operativo lo sepa antes de mandar. El texto sigue editable como hoy | Pantalla: la tarjeta de Bambu dice "En portugués"; la de Cuenca no |
| 6 | **Pedido a mano (M3-09):** si el proveedor elegido es de Brasil, el texto empieza con la plantilla pt | Unitario de `borradorAMano` con un proveedor de Brasil |
| 7 | **Los CSV viajan a producción** (`ciudades-portugues.csv` y la plantilla pt en `outputFileTracingIncludes`; mirar el `.nft.json` de la ruta de pedidos) | Build: el `.nft.json` de reservas/[id]/pedidos incluye los dos |
| 8 | **Nada más cambia:** los pedidos en castellano quedan idénticos | Recorridos M3 en verde (M3-12, M3-14, M3-28, M3-34, M3-35, M3-36) |

## Recorrido de punta a punta
DK1593147 (OD010C, Kilroy) con la base de pruebas y la IA falsa: el pedido a **Bambu** sale en portugués (asunto,
cuerpo, "1 noite", "com café da manhã" o sin él según M3-35, firma igual) y el pedido a **Cuenca** sigue en
castellano con los renglones de M3-36.

## El texto en portugués
Lo redacta el Programador en portugués de Brasil, cordial y simple (como la plantilla de castellano). Lo revisa
el owner (o alguien del equipo) en la pasada de M3-04, antes del envío real; cualquier ajuste es editar la
plantilla o la tabla de textos, sin tocar lógica.

## Qué queda afuera
- Otros idiomas (inglés a proveedores de otros países).
- Traducir la pantalla o los avisos internos.
- Leer las respuestas de los proveedores en portugués (M4).

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA (textos fijos, no traducción automática). **#4** nada a la base real
  ni a proveedores.

## Anexo técnico
- Plantilla: `data/plantillas/pedido-proveedor.md` y `src/lib/pedidos/plantilla.ts` (`cargarPlantilla`).
- Renglones en castellano: `src/lib/pedidos/formato.ts` (fechas `MESES`, habitación, pax) y `src/lib/pedidos/armar.ts`
  (pick up/drop off, vuelos, horario de M3-34, avisos dentro del mail). Sugerido: una tabla de textos por idioma
  (`es` / `pt`) que reciban las funciones de formato, en lugar de duplicar la lógica.
- El idioma se decide por grupo de pedido (una casilla de proveedor), con la `ciudad` del proveedor
  (`src/lib/pedidos/cargar.ts`).
- Base real (solo lectura) 2026-10-29: 276 proveedores, ninguno con `pais`; ~30 con `ciudad` de Brasil (BRASIL,
  FOZ DO IGUAZU, PARATY, ILHA GRANDE).

# M3-02 · Pantalla de revisión y envío

**Depende de:** M3-01

## 1. Qué queremos lograr
Desde el detalle de una reserva recibida, una persona del equipo toca **"Armar pedidos a
proveedores"** y ve cada pedido listo para mandar: a quién va, el asunto y el texto. Lo puede
corregir, sacar el que no quiere mandar y ver las tareas que quedan a mano. El botón **"Enviar N
pedidos"** abre una confirmación con la lista de destinatarios. En esta pieza la confirmación
todavía no manda nada: el envío lo conecta M3-03.

## 2. Qué hay hoy
- El detalle de una reserva (`src/components/reservas/detalle-reserva-pantalla.tsx`) y la lista
  (M2-05).
- Los borradores, las tareas y los avisos que guarda M3-01.
- El diseño acordado en `docs/arquitectura/user-flow.md` §5.4 y la marca en `docs/arquitectura/marca.md`.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **El botón "Armar pedidos a proveedores"** aparece en el detalle solo si la reserva está "recibida". En "para revisión" se ve deshabilitado con "Resolvé primero lo que está para revisión" | Test de pantalla con una reserva recibida y otra para revisión |
| 2 | **Una tarjeta por pedido:** proveedor(es), mail destino, CC (hoy ccalomarde@), asunto y texto, con los servicios que cubre. El texto y el asunto se editan; el destinatario no se edita acá, se cambia en el directorio | Test: editar el texto y volver a entrar muestra lo editado (queda guardado como borrador) |
| 3 | **"Incluir este pedido"** (por defecto sí) en cada tarjeta. El botón cuenta solo los incluidos: "Enviar 2 pedidos" | Test: destildar uno cambia el botón de "Enviar 3" a "Enviar 2" |
| 4 | **Proveedor sin mail:** tarjeta deshabilitada, con aviso ámbar y enlace "Completar en el directorio". El botón dice "Enviar N pedidos (1 queda pendiente)" | Test con un proveedor sin mail |
| 5 | **Tareas a mano a la vista:** "Emitir boleto: El Calafate → El Chaltén, 12/01" o "Contactar por WhatsApp: …", aparte de las tarjetas. No se envían | Test con ARCH31: la tarea aparece y no cuenta en "Enviar N" |
| 6 | **Avisos útiles arriba:** "Falta dato de llegada" (el pedido igual sale con "vuelo pendiente") y lo que reserva la agencia ("Journaway reserva estos hoteles: …; no se piden") | Test con una reserva sin vuelo y con el SPAP05 |
| 7 | **"Volver a armar"** regenera los borradores sin pisar los editados; si una persona editó un borrador, pregunta antes de reemplazarlo | Test: con uno editado, "Volver a armar" pide confirmación |
| 8 | **El diálogo "Enviar N pedidos"** lista cada destinatario, el CC y quién firma (el nombre de la persona con la sesión abierta). Mientras el envío real está apagado, dice bien visible: "Modo prueba: todo llega solo a ccalomarde@" | Test de pantalla del diálogo en los dos modos. **En esta pieza, confirmar no manda nada** (el botón llama a una acción de envío que todavía responde "falta conectar el envío") |
| 9 | **Solo el equipo:** la pantalla y sus acciones exigen sesión @hitravel.com.ar, igual que el resto de la app | Test: sin sesión redirige al login; la acción de guardar borrador rechaza sin sesión |

## 4. Qué ve el usuario
- **Pantalla nueva:** "Pedidos a proveedores" de una reserva (ruta hija del detalle, por ejemplo
  `/reservas/<id>/pedidos`).
- **El recorrido:** detalle de la reserva → "Armar pedidos a proveedores" → tarjetas y tareas →
  edita lo que quiera → "Enviar N pedidos" → diálogo con destinatarios → (M3-03 manda) → vuelve al detalle.
- **Carga:** "Armando los pedidos…" mientras se generan. **Error:** "No se pudieron armar los
  pedidos" con "Reintentar" y el motivo en llano. **Vacío:** si todo es a mano, "Esta reserva no
  tiene pedidos por mail; quedan estas tareas: …".

## 5. Qué queda afuera
- Mandar de verdad (M3-03).
- Editar el directorio desde esta pantalla: solo el enlace.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#4** — el envío exige una confirmación explícita que lista los destinatarios; esta pieza no
  envía nada.
- **#1** — la pantalla solo se ve con sesión del equipo.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) tests unitarios y de pantalla + linter + tipos → 2)
  integración contra la base de pruebas (guardar y releer borradores, sin sesión rechazado) → 3)
  recorrido con la pantalla real y una sesión del equipo sobre reservas de prueba.
- **Test primero.** Textos de la pantalla en `src/textos/`, como el resto.
- Server actions o rutas siguiendo el patrón de M2-05; nada de lógica de armado en el componente
  (la hace `src/lib/pedidos/`).

# Marca — identidad visual y tono

> **Dueño de:** la identidad visual y la voz de los textos de interfaz de Reservas de Catálogo HI
> Travel. **No decide** qué pantalla necesita backend, auth o IA (eso es del Arquitecto). Traza a
> `docs/prd.md` §1 (herramienta interna, equipo chico, registro central) y a
> [`user-flow.md`](user-flow.md) (estados, pantallas).

## 0. Principio rector

Es una **herramienta de trabajo interna** para 12 personas que leen datos y mueven reservas todo
el día. Tiene que sentirse **seria, rápida y densa en información**, como un sistema operativo de
trabajo, **no** como:

- un prototipo genérico de IA (degradés violeta-celeste, tarjetas flotantes, "✨ Powered by AI",
  ilustraciones tipo unDraw, mucho aire vacío);
- un SaaS de marketing (hero, botón gigante "Empezar gratis", tono motivacional, animaciones de
  scroll, testimonios);
- un panel de datos frío e ilegible (todo gris, sin jerarquía, sin color de estado).

Referencia de identidad: **HI Travel es un operador receptivo de Sudamérica** (Brasil, Argentina,
Uruguay, Chile, Bolivia) que le vende a agencias europeas. Oficio, prolijidad y confianza; nada de
exotismo turístico ni postales.

## 1. Paleta

### Neutros (la estructura)

| Uso | Hex |
|---|---|
| Fondo de la app | `#F6F7F9` |
| Superficie (tablas, tarjetas, paneles) | `#FFFFFF` |
| Superficie alterna (zebra de tabla, cabeceras) | `#F1F3F5` |
| Borde / divisor | `#E1E4E8` |
| Borde de control (input, botón secundario) | `#C6CCD3` |
| Texto principal | `#1B2430` |
| Texto secundario | `#5A6470` |
| Texto deshabilitado / placeholder | `#94A0AC` |
| Fila hover | `#F0F2F5` |
| Fila seleccionada | `#E7EFF6` |

### Marca y acción

| Uso | Hex |
|---|---|
| Primario (botón principal, enlaces, foco) | `#1F5F8B` |
| Primario hover / activo | `#184C6F` |
| Primario tenue (fondo de selección, badges neutros) | `#E7EFF6` |
| Anillo de foco | `#2F80C2` (2px, con 2px de offset) |
| Destructivo (texto y borde; fondo blanco) | `#B42318` |

Sin degradés. Sin color de acento "de marketing". El azul primario es el único color de marca;
todo lo demás es neutro o estado.

### Colores de estado de reserva (uno por estado)

Cada estado tiene un **texto de color** sobre un **chip de fondo claro**. Nunca se comunica el
estado solo por color: el chip **siempre lleva la etiqueta escrita**, y los estados terminales
llevan además un ícono. Paleta pensada para seguir siendo distinguible en visión con déficit de
color.

| Estado | Texto | Fondo del chip | Ícono | Lectura |
|---|---|---|---|---|
| **recibida** | `#3F4C5A` | `#EBEEF1` | — | neutro, recién llegó |
| **para revisión** | `#8A5300` | `#FBF0DB` | triángulo | ámbar: necesita a una persona |
| **pedido a proveedor** | `#1F5F8B` | `#E7EFF6` | flecha | azul: en curso, esperando afuera |
| **confirmada** | `#1E7B4F` | `#E3F2EA` | check | verde |
| **con cambios** | `#6B4BA3` | `#EFEBF8` | check-punteado | violeta: confirmada con diferencias |
| **rechazada** | `#B42318` | `#FBEAE8` | cruz | rojo |
| **cerrada** | `#5A6470` | `#EEF0F2` | archivo | gris, atenuado |
| **descartada** | `#5A6470` | `#EEF0F2` | descarte | gris; solo visible con filtro |

Todos los pares texto/fondo superan 4.5:1 de contraste (AA). El texto blanco sobre botón primario
también.

### Semánticos de feedback (mensajes, no estados de reserva)

| Uso | Texto | Fondo |
|---|---|---|
| Error | `#B42318` | `#FBEAE8` |
| Aviso / atención | `#8A5300` | `#FBF0DB` |
| Éxito | `#1E7B4F` | `#E3F2EA` |
| Info | `#1F5F8B` | `#E7EFF6` |

## 2. Tipografía

### Familias

- **Interfaz y datos:** `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica
  Neue", Arial, sans-serif`. Inter por su legibilidad a tamaño chico y sus **números tabulares**
  (`font-feature-settings: "tnum" 1`) — clave para columnas de fechas, pax y montos.
- **Monoespaciada** (código de producto, IDs de reserva, fragmentos de mail crudo): `"JetBrains
  Mono", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace`.

### Escala (compacta, para densidad)

| Rol | Tamaño / interlínea / peso |
|---|---|
| Título de página | 20px / 1.3 / 600 |
| Título de sección | 16px / 1.4 / 600 |
| Cabecera de tabla | 12px / 1.3 / 600, color `#5A6470` |
| Cuerpo base | 14px / 1.5 / 400 |
| Celda de tabla | 13px / 1.35 / 400 |
| Metadato / ayuda | 12px / 1.4 / 400, color `#5A6470` |
| Código (mono) | 13px / 1.4 / 400 |

- Pesos permitidos: 400, 500, 600. **Nada de 700+.**
- Sin mayúsculas de estilo marketing. Cabeceras de tabla en capitalización de oración.
- Números siempre tabulares en tablas y en el detalle.

## 3. Layout y densidad

- **Ancho:** la app usa el ancho disponible (máx. ~1440px de contenido). Nada de columna centrada
  angosta.
- **Grilla de espaciado:** múltiplos de 4 → 4 / 8 / 12 / 16 / 24 / 32.
- **Filas de tabla:** alto 36–40px, padding de celda `8px 12px`, zebra `#F1F3F5`, divisoria
  `#E1E4E8`. Encabezado fijo al hacer scroll.
- **Radios:** 4px en inputs, botones y chips; 6px en tarjetas y modales. El único elemento tipo
  "píldora" es el punto de estado.
- **Sombras:** una sola, sutil, reservada para lo que flota de verdad (menús, modales): `0 1px 2px
  rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.10)`. Tarjetas y paneles se separan con **borde de
  1px**.
- **Una acción principal por pantalla.**
- **Densidad alta pero respirada:** líneas divisorias claras, 16px entre grupos de campos y 8px
  dentro.

## 4. Componentes — lineamientos rápidos

- **Botones:** alto 32px (compacto) / 36px (normal).
  - Primario: fondo `#1F5F8B`, texto `#FFFFFF`, hover `#184C6F`.
  - Secundario: fondo `#FFFFFF`, borde `#C6CCD3`, texto `#1B2430`, hover fondo `#F0F2F5`.
  - Destructivo: texto y borde `#B42318`, fondo blanco; siempre con confirmación.
  - Terciario / enlace: sin fondo, texto `#1F5F8B`, subrayado al hover.
- **Chips de estado:** texto + fondo de la tabla §1; alto 20px, padding `2px 8px`, radio completo,
  etiqueta siempre escrita, ícono en los terminales.
- **Inputs:** borde `#C6CCD3`, foco con anillo `#2F80C2`; label **siempre visible arriba** del
  campo; error debajo, en `#B42318`, empezando por qué corregir.
- **Tablas:** ordenables por columna; fila entera clickeable para ir al detalle.
- **Iconografía:** set lineal simple (estilo Lucide / Feather), trazo 1.5–2px, 16px en botones y
  celdas, 20px en encabezados. Sin ilustraciones, sin mascotas. **Sin emojis en la interfaz.**
- **Marca en el header:** wordmark tipográfico `HI Travel` + separador + `Reservas de Catálogo`,
  en `#1B2430`, peso 600. Si existe un manual de marca corporativo de HI Travel, ese manda sobre
  esta paleta.
- **Modo oscuro:** fuera de alcance del MVP.

## 5. Voz de los textos de interfaz

### Cómo suena

- **Español rioplatense, directo y sobrio.** Voseo en los mensajes al usuario ("revisá", "cargá",
  "probá de nuevo"); infinitivo en los botones ("Guardar cambios", "Enviar pedidos", "Cerrar
  reserva").
- **Sin adornos.** Nada de "¡Genial!", "¡Ups!", "¡Listo!", signos de exclamación, ni tono
  motivacional. Una herramienta de trabajo informa, no anima.
- **Frases cortas.** Una idea por frase.
- **Errores accionables:** siempre **qué pasó + qué hacer**.
- **Vacíos orientadores:** el estado + el próximo paso.
- **El sistema no habla en primera persona** ("Guardé los cambios" ✗). Forma impersonal:
  "Cambios guardados".

### Terminología fija (glosario de la UI)

| Se dice | No se dice |
|---|---|
| reserva | booking (aunque el mail diga "NEW BOOKING") |
| agencia | cliente, agencia cliente, partner |
| proveedor | prestador, supplier |
| producto / código de producto | ítem, SKU, servicio de catálogo |
| pedido a proveedor | solicitud, request, RFP |
| pax (en tablas) · pasajeros (en el detalle) | viajeros, personas |
| para revisión / recibida / pedido a proveedor / confirmada / con cambios / rechazada / cerrada / descartada | cualquier sinónimo; los nombres de estado son fijos y coinciden con `user-flow.md` §3 |

- **Fechas:** `DD/MM/AAAA`. Rango: `12/03/2026 → 15/03/2026`. **Horas:** 24h, hora local del
  usuario.
- **Números:** separador de miles con punto, decimales con coma (es-AR). Pax sin decimales.

### Ejemplos concretos

| Situación | Texto |
|---|---|
| Botón principal, reserva `recibida` | Armar pedidos a proveedores |
| Botón principal, pantalla de envío | Enviar 3 pedidos |
| Confirmación de envío (diálogo) | Se van a enviar 3 mails: a Transportes del Sur, Hotel Andino y City Tours La Paz. ¿Confirmás? |
| Éxito de envío | Pedidos enviados. La reserva pasó a *pedido a proveedor*. |
| Error de extracción | No se pudo leer el mail de la agencia. Cargá los datos a mano o reintentá el procesamiento. |
| Producto sin emparejar | Este producto no coincide con ningún ítem del catálogo. Elegí el producto correcto o marcá la reserva como fuera de catálogo. |
| Proveedor sin mail | Este proveedor no tiene mail cargado. Completá el contacto en el directorio para poder enviarle el pedido. |
| Envío parcial | Se enviaron 2 de 3 pedidos. Falta *Hotel Andino*, sin mail cargado. |
| Posible duplicada | Esta reserva se parece a la #142 (misma agencia, producto y fechas). Revisala antes de seguir. |
| Bandeja vacía, primera vez | Todavía no entró ninguna reserva. Cuando llegue un mail a la casilla, va a aparecer acá. |
| Filtro sin resultados | Ninguna reserva coincide con estos filtros. |
| Catálogo vacío | El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar. |
| Conflicto de edición | Otra persona actualizó esta reserva. Mirá los cambios antes de guardar. |
| Sesión vencida | Tu sesión venció. Volvé a ingresar. Lo que estabas cargando se conserva. |
| Error de carga genérico | No pudimos cargar esta información. Reintentar. |

### Tono de los mails salientes a proveedores

(El contenido y las plantillas son de M3 / [`integraciones.md`](integraciones.md); acá solo el
tono.) Formal pero breve, en el idioma del proveedor (español; portugués para proveedores de
Brasil). Estructura: saludo, referencia de la reserva y el producto, fechas y pax, lista de
servicios pedidos, pedido explícito de confirmación de disponibilidad, cierre y firma de HI
Travel. Sin florituras comerciales.

## 6. Qué evitar (para no parecer template ni "hecho por IA")

- Degradés de fondo, degradés en botones, botones con brillo o sombra de color.
- Paleta violeta/celeste "de IA"; acentos neón; fondos oscuros con glow.
- Glassmorphism, blur, tarjetas flotantes con sombra grande y difusa.
- Ilustraciones genéricas (unDraw, Storyset), blobs, mascotas, íconos 3D.
- Emojis en la interfaz o en los estados.
- "Powered by AI", "✨", lenguaje que presuma de automatización mágica.
- Hero, subtítulo grande centrado, CTA gigante, secciones tipo landing.
- Tipografías display o redondeadas (Poppins, Comfortaa); pesos 700+ por todos lados.
- Spinners a pantalla completa y pantallas en blanco mientras algo carga (siempre esqueleto +
  contexto).
- Baja densidad: mucho padding, pocas filas por pantalla, tarjetas enormes para un dato.
- Animaciones de entrada/scroll; micro-interacciones decorativas. Transiciones solo funcionales
  (≤150ms).
- Inglés en la interfaz.

## 7. Supuestos a validar

1. **No hay `docs/icp.md`.** El glosario §5 está inferido del rubro; confirmar con el equipo real.
2. **Interfaz solo en español.** Si la oficina de Brasil necesita portugués, es i18n de toda la
   UI.
3. **No existe un manual de marca corporativo de HI Travel.** Si existe, tiene prioridad sobre §1
   y §2.
4. **"pax" es aceptado** por el equipo como término de tabla.
5. **Escritorio, resolución ≥1366px de ancho.**

## 8. Decisión técnica (ya tomada)

- **Fuente:** Inter y JetBrains Mono servidas desde el propio proyecto con `next/font` (sin CDN
  externo). Si la política de la empresa impidiera fuente web, se cae al stack de sistema (`Segoe
  UI` en las máquinas Windows del equipo) sin cambiar la escala.

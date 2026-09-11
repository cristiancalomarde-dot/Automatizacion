# Stack — con qué se construye y dónde corre

> **Dueño de:** las decisiones de tecnología, dónde vive la app, cómo se publica y el costo
> mensual estimado. **No cubre:** el modelo de datos (→ [`modelo-de-datos.md`](modelo-de-datos.md)),
> las claves (→ [`secretos.md`](secretos.md)), las integraciones (→ [`integraciones-ia.md`](integraciones-ia.md),
> [`integraciones.md`](integraciones.md)).

## En una frase

Una aplicación web hecha con **Next.js**, que corre en **Vercel**, con base de datos y login en
**Supabase**. Lee y manda mails desde una **casilla de Gmail dedicada** y usa la IA de **Anthropic
(Claude)** para interpretar los mails de reserva.

## Las piezas y por qué

| Pieza | Qué se eligió | Por qué |
|---|---|---|
| La app (pantallas + lógica) | **Next.js** (React, TypeScript) | Un solo proyecto para la interfaz y la lógica de servidor. Estándar para una herramienta interna así, y lo que el método de este repo ya asume. |
| Dónde corre | **Vercel** | Publica con `git push`, sin servidores que administrar. El plan gratis alcanza para el volumen (una docena de reservas por semana, ~12 personas). |
| Base de datos | **Supabase** (PostgreSQL administrado) | Base SQL seria sin operarla a mano. Incluye el login. El plan gratis alcanza de sobra. |
| Login | **Supabase Auth con "Ingresar con Google"** | El equipo ya tiene cuentas Google; nadie crea otra contraseña. Detalle en [`auth-y-permisos.md`](auth-y-permisos.md). |
| Leer y mandar mails | **Gmail API** sobre una casilla dedicada | Es la misma casilla que hoy usás en el Make. La app la lee sola y manda los pedidos a proveedores desde ahí, así las respuestas vuelven al mismo lugar. Detalle en [`integraciones.md`](integraciones.md). |
| Interpretar los mails | **API de Anthropic (Claude Sonnet 5)** | Lee cada mail de reserva y devuelve los datos ordenados aunque cada agencia escriba distinto. También ayuda al importador a leer los Excel. Techo de gasto en [`integraciones-ia.md`](integraciones-ia.md). |
| Revisar la casilla cada pocos minutos + correr el importador | **Tareas programadas de Vercel (Vercel Cron)** | Un disparador que cada ~5 minutos le pide a la app "fijate si entró algo nuevo". Sin infraestructura extra. |
| Leer los archivos Excel | Librería de lectura de planillas (**SheetJS**), del lado del servidor | El importador abre los `.xlsx`/`.xlsm` que subís y saca la info. Los Excel **no se sincronizan solos**: se suben y se procesan (ver [`integraciones.md`](integraciones.md)). |

## Cómo se publica

- El código vive en GitHub: `github.com/cristiancalomarde-dot/Automatizacion`.
- Cada cambio en la rama principal se publica solo en Vercel.
- Un entorno de producción (la URL que usa el equipo) y, si hace falta, uno de prueba.
- Las claves **no van en el código**: se cargan como variables de entorno en Vercel y Supabase
  (ver [`secretos.md`](secretos.md), regla #2).

## Costo mensual estimado (aproximado — la foto fina la da `/costo`)

| Concepto | Piso | Techo |
|---|---|---|
| Vercel | US$ 0 (plan Hobby) | US$ 20 (plan Pro, si se necesita por el equipo) |
| Supabase | US$ 0 (plan Free) | US$ 25 (plan Pro, si se supera el límite gratis) |
| API de Anthropic (Claude) | ~US$ 1 | ~US$ 5 (con reintentos y corridas del importador) |
| Casilla de Gmail | US$ 0 (la que ya existe, recibe el reenvío de Ferozo) | US$ 0 |
| **Total** | **~US$ 1 / mes** | **~US$ 50 / mes** |

A este volumen la IA cuesta centavos y los planes gratis alcanzan, así que el costo real casi
seguro cae en la parte baja. Correr `/costo` con la arquitectura cerrada para la estimación con
supuestos explícitos.

## Anexo técnico

- Next.js App Router; Server Actions o Route Handlers para la lógica de servidor. TypeScript.
- Supabase: Postgres + Auth (proveedor Google, dominio restringido). RLS activada aunque el
  modelo sea de datos compartidos (defensa en profundidad); ver [`modelo-de-datos.md`](modelo-de-datos.md).
- Ingesta Gmail: Route Handler protegido, disparado por Vercel Cron (`*/5 * * * *`), que usa la
  Gmail API (`gmail.readonly` para leer, `gmail.send` para enviar) con OAuth de la cuenta
  dedicada (client id/secret + refresh token en variables de entorno).
- IA: SDK `@anthropic-ai/sdk`, modelo `claude-sonnet-5`, `thinking: {type: "adaptive"}`, salida
  estructurada (`output_config.format`) con esquema JSON de los campos de la reserva. Alternativa
  de mayor precisión y costo: `claude-opus-5` — decisión revisable, ver [`integraciones-ia.md`](integraciones-ia.md).
- Lectura de planillas: SheetJS (`xlsx`) del lado del servidor; los archivos subidos se guardan en
  Supabase Storage para poder re-correr el importador.
- Zona horaria: el backend guarda en UTC; la interfaz muestra hora local del usuario.

## Abierto

- ~~¿La casilla de mail es una cuenta Gmail común nueva o del dominio `hitravel.com.ar`?~~ —
  **resuelto: US$ 0.** Es el Gmail común ya existente al que Ferozo reenvía `sales@hitravel.com.ar`
  (ver [`integraciones.md`](integraciones.md)); no hace falta Google Workspace para esto.
- ¿Vercel, Supabase y Anthropic quedan en una cuenta personal o en una cuenta de la empresa?
  Recomendado: **cuenta de la empresa** desde el día uno, con 2FA.

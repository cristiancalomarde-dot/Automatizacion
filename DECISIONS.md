<!--
PLANTILLA — DECISIONS.md (registro de decisiones de diseño)
Captura el "POR QUÉ" que la compactación de contexto suele perder.
Formato mínimo por entrada: qué decisión, por qué, alternativa rechazada, constraint, fecha.
-->

# Decisiones de diseño

## 2026-09-11: Casilla de mail = Gmail reenviado por Ferozo; dedupe por booking_id
- **Decisión:** (1) la casilla de mail que lee la app es el Gmail ya existente al que Ferozo
  reenvía automáticamente lo que llega a `sales@hitravel.com.ar` (el mismo que usaba el Make
  anterior) — no se toca la casilla original ni se migra de Ferozo/Outlook. Costo US$ 0. (2) Cada
  reserva guarda el `booking_id` que la agencia pone en el asunto; antes de crear una reserva
  nueva, el sistema busca si ya existe una con ese mismo booking_id — si existe, el mail es una
  respuesta dentro del mismo intercambio (piden/mandan datos de vuelo, pasaporte, etc.) y **no se
  crea una reserva duplicada**. El chequeo blando por remitente+producto+fechas+pax queda como red
  de seguridad aparte, para cuando no hay booking_id reconocible.
- **Razón:** (1) el reenvío ya existe y está probado (funcionaba con Make); conectar directo a
  Ferozo/Outlook sería otro protocolo sin ganar nada. (2) un mail de reserva típico tiene varios
  ida y vuelta (pedir datos de vuelo, pasaporte); sin este chequeo cada respuesta generaría una
  reserva nueva. Es el mismo mecanismo que ya tenía el Make (buscar el Booking ID antes de agregar
  la fila), formalizado como regla dura en vez de heurística blanda.
- **Alternativa rechazada:** migrar la ingesta a IMAP/Graph API directo sobre Ferozo/Outlook (más
  trabajo, sin beneficio real) · confiar solo en el chequeo blando de "posible duplicada" para las
  respuestas de un mismo hilo (generaría falsos positivos/negativos innecesarios cuando sí hay un
  identificador exacto disponible).
- **Constraint / consecuencia:** pendiente confirmar que el reenvío de Ferozo es una regla de
  servidor (24/7) y no una regla de Outlook de escritorio (dependería de una PC prendida) — se
  confirma antes de M2. `reserva.booking_id` se suma al modelo de datos.

## 2026-09-11: Datos de vuelo obligatorios para traslados; proveedores por WhatsApp quedan manuales; Asana pospuesto
- **Decisión:** (1) cuando el producto incluye un traslado, el sistema extrae/exige datos de
  vuelo (número, aerolínea, horario); si faltan, la reserva va a `para_revision` — sin eso no se
  le puede pedir el traslado a un proveedor. (2) `proveedor` suma un campo `canal` (`mail` |
  `whatsapp`); el MVP solo automatiza `mail` — un proveedor `whatsapp` nunca recibe un pedido
  automático, queda como la misma tarea manual pendiente que un tramo de bus. (3) La integración
  con Asana (crear una tarea por reserva para que la supervisora asigne casos entre operativos)
  queda **fuera del MVP**, anotada como candidata a un milestone posterior.
- **Razón:** (1) sin el vuelo, un pedido de traslado sale incompleto — es un dato crítico, no
  accesorio. (2) el owner confirmó que varios transferistas solo se manejan por WhatsApp; forzar
  ese canal en el MVP duplicaría el trabajo de integraciones.md sin necesidad, cuando el patrón de
  "tarea manual pendiente" ya existe para los buses. (3) Asana es una capa de gestión de equipo
  (asignación de casos) que el MVP no modela — tiene un solo rol sin asignación; sumarla ahora es
  construir dos cosas a la vez antes de probar el circuito base.
- **Alternativa rechazada:** intentar automatizar WhatsApp a proveedores en el MVP (fuera de
  alcance técnico y de tiempo) · construir la integración con Asana en paralelo al MVP (viola
  "una cosa a la vez").
- **Constraint / consecuencia:** `reserva.datos_vuelo` y `proveedor.canal` se suman al modelo de
  datos (`modelo-de-datos.md`); `integraciones.md` unifica el caso de borde "sin mail" y "solo
  WhatsApp" bajo el mismo flag `pedido incompleto`. Pasaportes y otros datos sensibles del
  pasajero, si se necesitan más adelante (ej. para Asana), reabren la regla #1 en serio (hoy no
  aplica porque no hay datos de terceros).

## 2026-09-11: Tours compuestos entran al MVP; Journaway se pospone
- **Decisión:** el catálogo (M1) modela dos tipos de producto: **simple** (como ya estaba) y
  **tour compuesto** — una secuencia ordenada de paquetes de catálogo y, a veces, tramos de bus
  público que HI Travel emite en su propio sistema de emisión, fuera de esta app. Los tramos de
  bus externos **nunca** generan un mail a un proveedor (no es un efecto hacia afuera de la app,
  regla #4 no aplica); quedan como tarea pendiente ("emitir boleto") dentro de la reserva. Un
  servicio de bus que es parte del producto de UN proveedor (ej. Uyuni→La Paz, incluido en el
  Overland boliviano) sí genera pedido por mail como cualquier servicio. Ejemplos de referencia
  dados por el owner: *Patagonia Highlights* = El Chaltén (paquete) + bus + El Calafate (paquete)
  + bus + Puerto Natales (paquete); *Overland San Pedro–Uyuni* = San Pedro de Atacama Explorer
  (paquete) + Overland Bolivia (paquete, un solo proveedor, incluye el bus Uyuni→La Paz como
  servicio propio — sin tramos externos). **Journaway** (mails en alemán/inglés, códigos de
  producto distintos, catálogo propio de 6-7 productos) queda **fuera del MVP**: se suma en un
  milestone posterior, después de validar el circuito con los formatos estándar. **Regla de
  transfer (afinada 2026-09-11):** en un tour compuesto solo llevan transfer las dos puntas del
  tour completo — el IN del primer destino y el OUT del último —; toda conexión intermedia
  resuelta con bus no lleva transfer, **excepto IGR/IGU** (Puerto Iguazú / Foz do Iguaçu), que lo
  mantienen aunque estén en el medio.
- **Razón:** los tours compuestos son "un porcentaje grande" de las reservas reales (Kilroy ya
  manda varias de Overland en los datos de prueba) — dejarlos fuera del MVP haría que el sistema
  no reflejara la demanda real, aunque técnicamente "funcionara". Journaway, en cambio, es bajo
  volumen (6-7 productos) y de formato tan distinto (idioma, remitente, códigos) que mezclarlo con
  el piloto inicial complica sin necesidad — se ataca mejor como su propio milestone acotado.
- **Alternativa rechazada:** mantener la exclusión original de "paquetes y tours combinados" del
  PRD (habría dejado el MVP probando una minoría del tráfico real) · incluir Journaway desde el
  arranque junto con las agencias estándar (formato demasiado distinto, sin necesidad de resolverlo
  ahora).
- **Constraint / consecuencia:** el modelo de datos suma `producto_componente` (ver
  `docs/arquitectura/modelo-de-datos.md`) y `integraciones.md` deja explícito que un tramo de bus
  externo no pasa por la regla #4. El armado exacto de cada tour compuesto se termina de confirmar
  al cargar el catálogo real en M1 (PRD §6, pregunta 6).

## 2026-09-09: Stack — app propia con Next.js + Vercel + Supabase; Make se da de baja
- **Decisión:** el producto se construye como una aplicación web propia (Next.js en Vercel, base de datos y login en Supabase, lectura/envío de mail vía Gmail API sobre una casilla dedicada, Claude para interpretar los mails). Make y el Google Sheet "Bookings Automation MVP" dejan de ser parte de la solución: se apagan cuando la app ingiere los mails (fin de M2).
- **Razón:** el MVP necesita una vista interna con estado editable y compartido (M4) y, a futuro, un módulo de costos — Make no tiene capa de interfaz y obligaría a apoyarse en Airtable/Sheets y a mantener dos herramientas. El "desarrollo a medida impagable" era con equipo humano; acá el desarrollo lo hace la IA con el método del repo. A ~12 reservas/semana los planes gratis de Vercel/Supabase alcanzan y la IA cuesta centavos.
- **Alternativa rechazada:** Make como núcleo (sin UI, dos sistemas) · Make como pegamento de ingesta de mail (una herramienta más para mantener; la app lee Gmail directo) · seguir con el MVP en Google Sheets (no escala a M4).
- **Constraint / consecuencia:** el trabajo previo en Make no se descarta como aprendizaje — aportó la validación del enfoque, la lista exacta de campos a extraer y el filtro de asunto "NEW BOOKING", y ~36 reservas reales de Kilroy que sirven como casos de prueba del lector con IA.

## 2026-09-09: La app aprende a leer los Excel actuales vía un importador re-ejecutable
- **Decisión:** los 3 Excel de HI Travel (productos/paquetes, tarifas, rutas de bus) y la hoja de proveedores no se tocan ni se reestructuran. Se construye un importador que los lee tal como están, extrae lo que la app necesita (código de producto → servicios → Service Provider / Booking Supplier → mail del proveedor) y lo carga en la base. Es re-ejecutable: se sube el archivo actualizado y vuelve a correr. Lo que no entiende con confianza queda en una cola "para revisar", nunca se inventa. Para el MVP el importador se enfoca en los productos que aparecen en las reservas de las agencias piloto.
- **Razón:** el owner trabaja solo en el proyecto y no tiene tiempo de mantener una planilla limpia paralela; además de esos Excel salen los precios de todos los tours, así que su estructura debe preservarse. Leerlos en vivo en cada reserva sería frágil (fórmulas, bloques por columna, filas en blanco a propósito).
- **Alternativa rechazada:** planilla limpia preparada a mano que la app importa (impracticable para el owner solo) · lectura en vivo de los Excel en cada operación (frágil, rompe seguido).
- **Constraint / consecuencia:** leer el Excel de paquetes (2218 filas, bloques verticales) es la parte más difícil del proyecto y va a necesitar varias vueltas de preguntas owner↔agente para afinar el lector. Anotado como riesgo. La IA (Claude) asiste al importador a interpretar bloques que las reglas simples no resuelven; ver `docs/arquitectura/integraciones-ia.md`.

## 2026-09-09: Lectura de mails con IA; envío a proveedores con aprobación por reserva
- **Decisión:** (1) cada mail de reserva lo interpreta Claude (Sonnet 5) y devuelve los campos ordenados; el emparejado del producto se hace primero por el código del mail contra una tabla de códigos y la IA solo entra como respaldo; con confianza baja la reserva va a "para revisión". (2) Los mails a proveedores nunca salen solos: la app los redacta y una persona confirma el envío de a una reserva por vez (un clic manda todos los pedidos de esa reserva). Techo de gasto de IA: US$ 20/mes, chequeado antes de cada llamada (regla #3).
- **Razón:** cada agencia escribe distinto y las plantillas regex se rompen al crecer; la IA es robusta al formato y a este volumen cuesta centavos. La aprobación por reserva cumple la regla #4 con mínima fricción (~12 clics/semana vs. ~30-40 mail por mail).
- **Alternativa rechazada:** plantillas fijas por agencia (frágiles) · aprobación mail por mail (más control fino, mucha más fricción) · envío automático sin revisión (viola la regla #4).
- **Constraint / consecuencia:** la automatización del envío (sacar la aprobación humana) se evalúa recién si la extracción demuestra <2-3% de corrección manual sostenida sobre varias decenas de reservas; cambiarla exige editar la regla #4 y anotarlo acá. Anotado como pregunta abierta en `docs/prd.md` §6.1. Modelo (Sonnet 5 vs Opus 5) se confirma con la precisión medida en las piloto (riesgo #1 del PRD).

## 2026-09-09: Login con Google restringido al dominio, rol único
- **Decisión:** se entra con "Ingresar con Google", solo direcciones del dominio de HI Travel. Un único rol "operador" en el MVP: los ~12 del equipo ven y editan todo (reservas, catálogo, proveedores). Sin permisos finos.
- **Razón:** el equipo ya tiene cuentas Google; equipo chico y de confianza; modelar roles ahora es complejidad sin demanda real.
- **Alternativa rechazada:** usuario/contraseña propio (otra credencial que gestionar) · rol "aprobador" separado desde el día uno (sin pedido del negocio).
- **Constraint / consecuencia:** si más adelante hay que restringir quién aprueba envíos, se agrega un rol y cambia `docs/arquitectura/auth-y-permisos.md`.

## 2026-08-18: Arquitectura multi-documento + el PRD como mapa
- **Decisión:** `/arquitectura` vuelve a escribir un documento por tema en `docs/arquitectura/` — siempre: `stack.md` (incluye deploy y costo mensual), `modelo-de-datos.md` (#1), `secretos.md` (#2), `user-flow.md`, `marca.md`; condicionales (si no aplican, no se crean y el índice lo marca): `integraciones-ia.md` (#3), `integraciones.md` (#4), `auth-y-permisos.md`. Al terminar, el Arquitecto completa la sección §7 "El cómo técnico" de `docs/prd.md` con los links. Sigue sin subagentes (todo en la misma pasada).
- **Razón:** un archivo único mezclaba temas de peso muy distinto; documentos separados permiten linkear con precisión desde specs y constitución, y el PRD como mapa le da al owner un solo punto de entrada. La lista se alineó con la slide 20 de la masterclass (stack · modelo de datos · user flow · marca · IA · autenticación · deploy), sumando marca y auth que faltaban en la lista inicial.
- **Alternativa rechazada:** mantener `decisiones.md` único (mezclaba todo) · un doc por tema con fan-out a subagentes (lento, ya descartado en v2).
- **Constraint:** los condicionales no se rellenan con "N/A" largos — no se crean; el índice de `docs/arquitectura/README.md` y el §7 del PRD son quienes registran el descarte en una línea.

## 2026-08-18: Alinear los comandos al workflow de la masterclass
- **Decisión:** el harness adopta los 8 comandos del mapa público de la masterclass (slide 18): `/icp` · `/solucion` · `/prd` · `/arquitectura` · `/roadmap` · `/specs` · `/implementar` · `/deploy`. Renombres: `/new-prd`→`/prd`, `/new-architecture`→`/arquitectura`, `/deploy-check`→`/deploy` (ahora con GO + confirmación ejecuta el deploy real). `/new-plan` se parte en `/roadmap` (el plan) y `/specs` (las fichas), ambos orquestando la misma skill `planner`. Nuevo `/implementar <ID>` como wrapper del despacho a `builder`. `/empezar` y `/save-point` siguen como transversales.
- **Razón:** un solo vocabulario entre la charla, el curso y el harness — lo que el alumno ve en las slides es exactamente lo que tipea en el repo.
- **Alternativa rechazada:** mantener `/new-plan` fusionado y ajustar las slides — el material público manda; la fusión se conserva a nivel doctrina (una skill), solo se parte la orquestación.
- **Constraint:** la skill `planner` sigue siendo la única dueña de la doctrina de plan+specs; los dos comandos solo ejecutan fases distintas de ella.

## 2026-08-17: Harness v2.1 — optimización 80/20 para founders no técnicos
- **Decisión:** cuatro mejoras a la interfaz con el founder: (1) `/empezar` como puerta de entrada humana (dónde está el proyecto + el único paso siguiente); (2) "probalo vos" al cerrar cada milestone — el agente levanta la app, sirve el link y el milestone no se archiva sin la confirmación del owner (nunca a nivel spec: sería mucho); (3) toda pregunta técnica se sirve digerida — qué significa en llano, pros/contras y una opción sugerida; (4) borrar `QUALITY.md`.
- **Razón:** análisis de primeros principios + Pareto: el núcleo del método ya estaba; los gaps eran de interfaz humana — el founder no puede leer código, solo puede juzgar usando la app y con explicaciones en llano, y no sabe levantar servers.
- **Alternativa rechazada:** ritual de "cuando algo se rompe" (descartado por el owner) · renombrar los comandos a verbos de founder (se mantienen los nombres actuales por el material del curso) · "probalo vos" por spec (demasiada fricción).
- **Constraint:** la regla de trade-offs vive en las skills (doctrina); el "probalo vos" en CLAUDE.md y las plantillas (flujo) — sin duplicar entre capas.

## 2026-08-17: Simplificar el harness (v2 — rápido y en llano)
- **Decisión:** reducir el equipo de 11 a 6 roles (el Programador `builder` implementa Y verifica; el Planificador `planner` hace plan + specs en un comando `/new-plan`; DevOps absorbe el chequeo de costo), dejar 2 rondas de preguntas en todo el flujo, un solo archivo de arquitectura (`decisiones.md`), estado en un solo lugar (la tabla del plan), plantillas cortas cuyas secciones no aplicables se borran, y todos los documentos visibles en lenguaje llano con anexos técnicos para los agentes. Tres capas con responsabilidad única: skill = CÓMO, agente = QUIÉN, command = ejecución — sin duplicar contenido entre capas.
- **Razón:** en la demo en vivo el harness v1 era lentísimo: ~22.500 palabras de instrucciones, ~18 subagentes mayormente en serie, hasta 11 rondas de preguntas y estado por triplicado. Y el usuario final no es técnico.
- **Alternativa rechazada:** mantener el harness completo y agregar un modo `--fast` aparte — doble mantenimiento; y eliminar las skills moviendo la doctrina a los commands — rompía la separación CÓMO/QUIÉN/ejecución.
- **Constraint:** toda doctrina vive en su skill y se referencia (no se copia) desde commands y agentes; el punto de retorno pre-cambio es el commit `42eb607`.

## <AAAA-MM-DD>: <Título corto de la decisión>
- **Decisión:** <qué se decidió>
- **Razón:** <por qué>
- **Alternativa rechazada:** <qué se descartó y por qué>
- **Constraint / consecuencia:** <restricción que esto impone hacia adelante>

## 2026-01-15: Usar Redis para cachear preferencias de usuario
- **Decisión:** cachear las preferencias de usuario en Redis.
- **Razón:** alta frecuencia de lectura (cada llamada de API), datos chicos.
- **Alternativa rechazada:** vista materializada en PostgreSQL — la alta frecuencia de cambio no justifica el costo de mantenimiento.
- **Constraint:** TTL de cache de 5 minutos, invalidación activa al escribir.

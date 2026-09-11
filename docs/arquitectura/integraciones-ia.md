# Integración con IA — interpretar los mails y ayudar al importador

> **Dueño de:** la **regla #3** (techo de gasto). Qué modelo se usa, para qué, y cuánto puede
> gastar.

## Para qué se usa la IA

1. **Leer el mail de reserva.** Cada mail que entra a la casilla se le pasa a Claude, que devuelve
   los datos ordenados: producto y código, fechas de entrada/salida, cantidad de pasajeros,
   ciudades, habitación/categoría, datos de vuelo, pedidos especiales. Funciona aunque cada
   agencia escriba distinto — y aunque la reserva no venga en el cuerpo del mail: **algunas
   agencias (ej. TourRadar) la mandan como PDF adjunto** en vez de texto (Kilroy/Jysk sí la traen
   en el cuerpo). La lectura revisa primero si hay un PDF adjunto y, si lo hay, se lo pasa a
   Claude directamente como documento (Claude lee PDF nativamente, sin convertirlo a texto
   aparte); si no hay adjunto, usa el cuerpo del mail.
2. **Ayudar al importador a leer los Excel.** Los Excel de productos son planillas hechas para
   humanos (bloques por columna, filas en blanco a propósito). Cuando el importador no puede sacar
   un producto con reglas simples, le pide a Claude que interprete ese bloque. Lo que la IA
   tampoco resuelve con confianza queda **"para revisar"** (nunca se inventa).

El **emparejado del producto** no lo decide la IA sola: primero se busca el código del mail contra
la tabla de códigos (exacto, gratis). La IA solo entra si el código falta o no matchea, y su
propuesta con confianza baja manda la reserva a "para revisión".

## Regla #3 — techo de gasto, chequeado antes de gastar

- **Techo mensual:** US$ 20. Al llegar al 80% (US$ 16) la app avisa; al 100% deja de llamar a la
  IA y las reservas nuevas caen directo en "para revisión" para carga manual (no se pierde
  ninguna).
- **Tope por mail:** si un mail obligara a un gasto fuera de lo normal (mail gigante), se corta y
  va a "para revisión".
- El gasto acumulado del mes se guarda y se chequea **antes** de cada llamada.

A los volúmenes reales (~12 reservas/semana), el gasto esperado es de **centavos a pocos dólares
por mes**. El techo de US$ 20 es un cinturón de seguridad, no una previsión.

## Anexo técnico

- Modelo: `claude-sonnet-5` (suficiente para extracción acotada; US$ 2 / US$ 10 por millón de
  tokens in/out). Alternativa de mayor precisión: `claude-opus-5` (US$ 5 / US$ 25). Decisión
  revisable si la precisión de extracción no alcanza el umbral del PRD (riesgo #1).
- Salida estructurada: `output_config.format` con esquema JSON de los campos de la reserva + un
  campo `confianza` por campo y global.
- `thinking: {type: "adaptive"}`. `max_tokens` acotado (~1500 para extracción).
- Estimación por mail: ~3.000 tokens de entrada (prompt + mail) + ~500 de salida ≈ US$ 0,01.
  50 mails/mes ≈ US$ 0,55.
- Contador de gasto: tabla `uso_ia` (mes, tokens_in, tokens_out, costo_estimado). Middleware que
  suma y frena antes de cada llamada.
- Umbral de confianza para auto-aceptar el emparejado por IA: arranca conservador (alto); se
  ajusta con los datos de las agencias piloto (PRD riesgo #1: si >20% necesita corrección manual,
  se frena).
- El mail del cliente se manda a la API de Anthropic (que no entrena con datos de API). Aun así:
  en el prompt va solo el cuerpo del mail y sus datos; nada de credenciales.

## Abierto

- Modelo definitivo (Sonnet 5 vs Opus 5): se decide con la precisión medida en las piloto.
- ¿Conviene además un modo "plantilla por agencia" como respaldo para cuando la IA esté caída o el
  techo se agote? Evaluar tras las primeras semanas.

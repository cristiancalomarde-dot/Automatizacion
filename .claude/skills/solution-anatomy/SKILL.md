---
name: solution-anatomy
description: Método completo para definir la solución (el QUÉ del producto) según su tipo de entrega — el límite con la oferta y un template por modelo (curso/DIY, implementación/DFW, acompañamiento/DWY, producto/SaaS) más un fallback genérico. Usar al construir o refinar una solución.
---

# Solution Anatomy — el QUÉ del producto

Este skill es la **fuente de verdad** para construir una solución en FORGE. Una
solución define **qué es el producto y qué recibe el cliente** — con la mayor
claridad y al grano posible. No inventa un método nuevo cada vez: ejecuta la
estructura que corresponde al **tipo** de solución.

## El límite solution ↔ offer (leer primero, no cruzarlo)
Dos artefactos distintos, dos preguntas distintas:

- **Solution = el QUÉ.** Qué es el producto, para quién, qué incluye, cómo funciona,
  qué se lleva el cliente, y su **precio base** (el precio ancla/general, sin
  descuentos). Describe el producto como es.
- **Offer = el CÓMO volverlo comercialmente irresistible.** Toma la solución y le
  agrega la arquitectura de venta: headline afilado, agitación del problema,
  transformación antes→después, prueba social, **estrategia de precios** (tiers,
  descuentos, Early Bird, add-ons/bundles), urgencia, escasez, bonos, garantía,
  incentivo early-adopter, FAQs y CTA.

**Regla dura:** en la solución va SOLO el **precio base**. Todo lo demás que sea
comercial —descuentos, urgencia, escasez, garantía, bonos, add-ons— es territorio de
la OFERTA. Si te descubrís escribiendo un "50% OFF por tiempo limitado" en la solución,
pará: eso es oferta. La promesa del producto es la materia prima que la OFERTA después
afila en headline; acá se escribe clara y honesta, no se la "vende".

## Cómo se elige la estructura: por tipo de entrega
`/solucion <tipo>` recibe el tipo como parámetro. Lo que **cambia la anatomía** no es el
tema del producto sino **quién hace el trabajo** y **qué recibe el cliente**. Ese es el eje:

```
  DIY ──────────────── DWY ──────────────── DFW           (servicio: quién ejecuta)
  lo hace el cliente   lo hacen juntos      lo hacemos nosotros
  = curso              = acompañamiento     = implementación

  Producto / Plataforma / Agentes / SaaS                  (producto: el cliente lo USA, nadie "ejecuta un engagement")
```

Cada tipo tiene su template propio. Elegí por el alias:

| Tipo (alias `/solucion <x>`) | Modelo | El cliente recibe… |
|---|---|---|
| `curso` | **DIY** — Do It Yourself | el método para hacerlo él mismo |
| `implementacion` (`dfw`) | **DFW** — Done For You | el sistema construido y funcionando, hecho por nosotros |
| `acompanamiento` (`dwy`) | **DWY** — Do With You | la solución co-construida + la capacidad instalada de mantenerla |
| `producto` (`saas`, `plataforma`, `agentes`) | **Producto** | acceso a un producto/plataforma/agente que usa |

Si el tipo no cae en ninguno, usá la **estructura genérica de fallback** (final del doc) y
adaptala con criterio al producto real, declarando lo que asumas.

### Regla transversal de pricing (aplica a todos los tipos)
En la solución va el **precio base** y —solo para producto/SaaS— el **modelo de cobro base**
(suscripción vs pago único, por asiento vs por uso): eso es parte del QUÉ. Los **tiers
promocionales, descuentos, Early Bird, bundles y add-ons** NUNCA van acá — son de la OFERTA.

Reglas de proceso, cualquiera sea el tipo:
- **Un bloque por vez.** Proponé, validá con el usuario, avanzá. No vuelques el doc entero de una.
- **Derivá del ICP + la descripción real del producto.** Cada afirmación se traza a una
  fuente real; si no, es supuesto → marcalo y registralo en `assumptions.md`.
- **No inventes** datos, features ni resultados. Hueco honesto > relleno.
- **Al grano.** Prosa clara, sin jerga vacía. El mejor doc de solución se lee rápido y
  no deja dudas de qué es el producto.

---

## Template — tipo `curso` (DIY · Do It Yourself)
El cliente **aprende y ejecuta él mismo**. El entregable es el método. Estructura extraída
del patrón que ya funciona (el doc del curso "De la idea a tu AI App"). Orden de secciones:

1. **Título + promesa de apertura.** Nombre del curso + una línea que dice el resultado
   (qué logra el alumno), + un blockquote de posicionamiento (para quién es, en una frase).
2. **La promesa.** El "de X a Y en Z tiempo": de dónde parte el alumno y a dónde llega,
   en cuánto. Qué aprende de fondo (no solo el output). El mecanismo distintivo del curso
   (qué lo hace distinto de "mirar tutoriales").
3. **Para quién es (y para quién no).** Dos listas explícitas. El "para quién no" filtra
   y sube credibilidad tanto como el "para quién sí".
4. **Qué vas a construir / lograr.** El resultado tangible que el alumno se lleva
   (el proyecto, el producto, el artefacto). Concreto y visible.
5. **Lo que te llevás (recursos / entregables).** Todo lo que queda en manos del alumno:
   materiales, plantillas, herramientas, accesos. Lo que hace que no arranque de cero.
6. **Formato.** Modalidad (vivo/grabado/async), duración total y por sesión, cadencia,
   **dedicación estimada del alumno**, idioma, cupo, certificado, soporte entre sesiones.
7. **Requisitos y costo de herramientas.** Qué necesita el alumno para tomarlo:
   requisitos de equipo + las herramientas y su costo real (qué es gratis, qué se paga y
   cuánto). Responde de entrada la objeción "¿qué me va a costar además del curso?".
8. **El mecanismo por dentro / programa.** El recorrido detallado (para un curso: clase
   por clase, con objetivo y contenidos "X para lograr Y"). Es lo que prueba que hay un
   método y no improvisación.
9. **Resumen del recorrido.** Una tabla que comprime el programa: etapa → qué obtenés al
   terminar cada una. Permite escanear el valor completo de un vistazo.
10. **Precio base.** SOLO el precio ancla/general del curso (sin tiers ni descuentos).
    La estrategia comercial de precios se construye en la OFERTA.

> Nota: secciones como "tu equipo de agentes" del curso ejemplo son **contenido
> específico del producto** dentro de "qué vas a construir / lo que te llevás", no una
> sección genérica del template. Adaptá según el mecanismo real del curso.

---

## Template — tipo `implementacion` / `dfw` (DFW · Done For You)
**Lo hacemos nosotros.** El cliente delega el problema y recibe el sistema construido y
funcionando. Lo que se vende es el resultado operando + el trabajo hecho. El eje del doc es
el **traspaso**: qué queda funcionando en sus manos y cómo. Orden de secciones:

1. **Título + promesa de apertura.** Nombre del servicio + una línea con el resultado que
   queda funcionando + un blockquote de posicionamiento (para quién, en una frase).
2. **La promesa.** El "de X a Y en Z tiempo": del estado actual (proceso manual/roto, sin
   capacidad interna) al sistema funcionando, y en cuánto. Qué queda **operando sin ellos**.
3. **Para quién es (y para quién no).** El "para quién no" filtra: descarta a quien quiere
   ejecutar él mismo (eso es DWY o curso) o no tiene el problema al tamaño que justifica DFW.
4. **Qué construimos / entregamos.** El sistema/artefacto tangible que queda funcionando.
   Concreto y visible — no "una estrategia", sino qué específicamente existe al final.
5. **El proceso de trabajo.** Las fases del engagement (p. ej. diagnóstico → diseño → build
   → entrega/handover), cada una con qué pasa, qué se decide y qué se produce. Es lo que
   prueba que hay método y no improvisación.
6. **Qué necesitamos de vos.** Los inputs del cliente: accesos, información, puntos de
   contacto y su tiempo. DFW es **mínimo** esfuerzo del cliente, no cero — sé honesto acá.
7. **Entregables y traspaso.** Qué queda en manos del cliente al terminar: el sistema +
   documentación + training/handover + accesos. Cómo lo opera después sin nosotros.
8. **Alcance y límites.** Qué incluye y qué **NO** incluye el engagement (evita scope creep),
   y cuántas revisiones/iteraciones entran. Un límite claro sube credibilidad y protege el precio.
9. **Formato.** Duración del engagement, cadencia de contacto, quién de nuestro lado, canales,
   y soporte post-entrega / garantía **técnica** (no comercial: la garantía de venta es de la OFERTA).
10. **Requisitos y costo de herramientas.** Infra/licencias que el cliente necesita **mantener**
    después (hosting, APIs, plataformas) con su costo recurrente real. Responde "¿qué me cuesta
    además del servicio, para siempre?".
11. **Precio base.** SOLO el precio ancla/general del engagement (sin tiers ni descuentos).

---

## Template — tipo `acompanamiento` / `dwy` (DWY · Do With You)
**Lo hacemos juntos.** Nosotros guiamos y aportamos método; el cliente ejecuta con su equipo.
El resultado es **doble**: la solución implementada **y** la capacidad instalada para
sostenerla. El eje del doc es la **división de responsabilidades**. Orden de secciones:

1. **Título + promesa de apertura.** Nombre + una línea con el resultado co-construido +
   blockquote de posicionamiento (para quién, en una frase).
2. **La promesa.** El "de X a Y en Z tiempo": parte con equipo/ganas pero sin dirección ni
   método → termina con la solución implementada **y** el know-how instalado. Nombrá los dos
   resultados: el artefacto y la capacidad que queda.
3. **Para quién es (y para quién no).** Filtro clave del DWY: necesita **tener quién ejecute
   de su lado**. Descarta a quien quiere delegar del todo (eso es DFW) o aprender solo (curso).
4. **Qué vas a lograr / construir juntos.** El resultado tangible co-construido. Concreto.
5. **Cómo trabajamos juntos.** El modelo de acompañamiento: sesiones de trabajo, **qué hacemos
   nosotros / qué hacés vos**, y el ritmo. Este reparto explícito es el mecanismo distintivo.
6. **El recorrido / programa.** Las etapas del acompañamiento, cada una con objetivo + qué se
   produce + quién hace qué. Es la prueba de que hay método guiado y no "reuniones sueltas".
7. **Qué se necesita de tu lado.** Dedicación del equipo del cliente, roles y tiempo. DWY exige
   **más** del cliente que DFW — sé explícito para que no lo tome quien no puede sostenerlo.
8. **Lo que te llevás.** El artefacto implementado + la capacidad/método instalado + materiales,
   plantillas y accesos que quedan en el equipo.
9. **Formato.** Duración, cadencia de sesiones, modalidad (vivo/híbrido), canales de soporte
   entre sesiones, cupo si aplica.
10. **Requisitos y costo de herramientas.** Qué necesita el equipo para ejecutar + costo real
    de las herramientas (qué es gratis, qué se paga y cuánto).
11. **Precio base.** SOLO el precio ancla/general del programa (sin tiers ni descuentos).

---

## Template — tipo `producto` / `saas` / `plataforma` / `agentes` (Producto)
El cliente **usa un producto**; no hay engagement humano ejecutándose. El eje del doc son las
**capacidades** (jobs que habilita) y **cómo se llega al valor** al usarlo. Orden de secciones:

1. **Qué es.** Definición en una línea (qué categoría de producto es) + qué problema resuelve.
2. **La promesa / resultado.** El "de X a Y" que habilita usarlo: qué cambia en el día a día
   del usuario una vez que lo adopta.
3. **Para quién es (y para quién no).** Dos listas. El "para quién no" filtra por caso de uso
   y por encaje técnico (quién no lo va a poder integrar o no lo necesita a este tamaño).
4. **Qué hace / capacidades.** Las capacidades core, **cada una con el resultado que habilita**
   (jobs-to-be-done, no features sueltas). Para agentes: qué automatiza y qué decisiones toma
   por su cuenta vs qué queda en manos humanas.
5. **Cómo funciona.** El recorrido del usuario del alta al valor (onboarding → uso → resultado)
   y **cómo se integra** con lo que ya usa (fuentes de datos, herramientas, permisos).
6. **Qué obtenés / entregables.** Accesos, integraciones activas, y los datos/outputs que el
   producto produce (reportes, acciones ejecutadas, artefactos generados).
7. **Formato y modelo de entrega.** SaaS self-serve / plataforma / agentes desplegados; nivel de
   setup (self-serve vs asistido), y soporte/SLA **técnico**.
8. **Requisitos y costo de herramientas.** Qué necesita para correr (navegador, cuentas,
   permisos), integraciones requeridas, y costos de terceros (APIs, infra) si los paga el cliente.
9. **Precio base.** El **modelo de cobro base** (suscripción vs pago único, por asiento vs por
   uso vs flat) y su precio ancla. Los tiers promocionales, trials y descuentos son de la OFERTA.

---

## Estructura genérica de fallback (tipos sin template propio)
Para lo que no cae en los cuatro templates (comunidad, membresía, híbridos, etc.).
Mismo espíritu (el QUÉ, con precio base), adaptá los nombres al producto:

1. **Qué es** — definición en una línea + qué problema resuelve.
2. **Para quién es (y para quién no).**
3. **Qué incluye** — componentes / features / entregables del producto (core + extras),
   cada uno con qué logra para el cliente.
4. **Cómo funciona** — el recorrido del cliente en pocos pasos, del alta al resultado.
5. **Qué obtenés** — el resultado tangible / la transformación concreta.
6. **Formato y requisitos** — modalidad de entrega, qué necesita el cliente para usarlo,
   costo de herramientas si aplica.
7. **Precio base** — el precio ancla, sin estrategia comercial.

---

## Metadata y salida
El entregable arranca con el bloque de metadata del OS:

    > Basado en: <ruta-icp> | Tipo: <tipo> | Supuestos abiertos: N | Fecha: YYYY-MM-DD

Se escribe en `docs/solucion.md` (archivo plano, sin versión `NN`; si ya existe, se
refina in-place).

## Antipatrones
- **Meter lo comercial en la solución** (descuentos, urgencia, escasez, garantía, bonos,
  add-ons). Eso es de la OFERTA. En la solución va solo el precio base.
- Vender features en vez del resultado que habilitan.
- Prometer más de lo que el producto entrega (el "después" tiene que ser creíble).
- Un "para quién es" que no filtra a nadie ("para todos los que quieran crecer").
- **Confundir el modelo de entrega:** vender un DFW pero pedirle al cliente que ejecute
  (eso es DWY), o un DWY sin decir qué hace su equipo. El eje quién-hace-el-trabajo tiene
  que ser inequívoco — es lo que el cliente compra.
- En producto/SaaS, meter tiers/trials/descuentos en "precio base": solo va el modelo de
  cobro base y su ancla; lo promocional es de la OFERTA.
- Inventar entregables, requisitos o resultados que no existen todavía.
- Reconstruir de cero una solución ya escrita: se **audita y refina** contra el ICP.

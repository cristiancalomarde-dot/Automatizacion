# La constitución — las reglas innegociables

> **Dueño de:** la lista de reglas que ninguna pieza de trabajo puede violar, numerada para poder
> citarlas por `#<n>`. El detalle de cada regla vive en su archivo dueño (columna "Dueño").
> **Cómo se usa:** desde un plan o una spec, la regla se cita por número (`#3`), nunca se copia el
> enunciado — así hay una sola versión de cada regla. Para cambiar una, se edita acá y en su dueño,
> y se buscan los lugares que la citan (`grep -rn "#3" docs/`).
> **Cómo se agrega una:** se escribe en su archivo dueño y se le da acá el siguiente número libre.
> Los números son estables: no se reutilizan aunque una regla se retire.

| # | Regla | Dueño |
|---|---|---|
| **1** | Si hay datos de más de un usuario, cada dato pertenece a su dueño: ningún usuario puede ver ni tocar lo de otro. | _pendiente — lo completa `/arquitectura` en `docs/arquitectura/modelo-de-datos.md`_ |
| **2** | Las claves y secretos (API keys, contraseñas) salen de variables de entorno; NUNCA van en el código ni en el repo. | _pendiente — `docs/arquitectura/secretos.md`_ |
| **3** | Toda llamada a la IA o a un servicio pago tiene un techo de gasto que se chequea ANTES de gastar. | _pendiente — `docs/arquitectura/integraciones-ia.md`_ |
| **4** | Toda acción con efecto hacia afuera (mandar un mail, cobrar, publicar) pasa por aprobación humana explícita. | _pendiente — `docs/arquitectura/integraciones.md`_ |
| **5** | Terminado = las 3 verificaciones en verde, en orden (unitarias+linter → integración → recorrido completo). Nada se cierra sin esto. | [`README.md` § Qué significa "terminado"](README.md) |

**Cuándo aplica cada una:** la #1 si la pieza toca datos de usuarios · la #2 si maneja claves ·
la #3 si consume IA o servicios pagos · la #4 si ejecuta acciones hacia afuera · la **#5 siempre**.

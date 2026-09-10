# Autenticación y permisos — cómo se entra y qué puede hacer cada uno

> **Dueño de:** cómo inicia sesión el usuario y qué puede hacer cada rol. No numera reglas nuevas.

## Cómo se entra

- **"Ingresar con Google".** El equipo ya tiene cuentas Google; nadie crea otra contraseña.
- **Restringido al dominio de la empresa:** solo direcciones `@hitravel.com.ar` (o el dominio que
  corresponda) pueden entrar. Una cuenta de afuera queda rechazada aunque tenga el link.
- No hay registro abierto ni recupero de contraseña: la identidad la maneja Google.

## Qué puede hacer cada uno

- **Un solo rol en el MVP: "operador".** Los ~12 del equipo pueden ver todas las reservas,
  corregir datos, aprobar el envío a proveedores, actualizar estados y editar el catálogo y los
  proveedores.
- No se modelan permisos finos (quién aprueba, quién solo mira) en el MVP. Si más adelante hace
  falta restringir la aprobación de envíos a ciertas personas, se agrega un rol y esta decisión
  cambia.

## Anexo técnico

- Supabase Auth, proveedor Google OAuth, con lista blanca de dominio (`hd` claim + check en el
  callback + policy).
- Alta de usuarios: la primera vez que alguien del dominio entra, se le crea la fila `usuario` con
  rol `operador`.
- Todas las rutas de la app requieren sesión; las tareas de sistema (cron) usan `CRON_SECRET`, no
  una sesión de usuario.
- RLS: `authenticated` puede todo lo del rol operador; sin sesión, nada.

## Abierto

- ¿El alta es automática para cualquier `@hitravel.com.ar` o con lista blanca de mails aprobados?
  Recomendado: automática por dominio para el MVP (equipo chico y de confianza).
- Rol de "aprobador" separado: solo si el negocio lo pide.

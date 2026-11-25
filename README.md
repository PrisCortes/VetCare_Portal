# VetCare Portal de Propietarios

Portal de solo consulta para los propietarios de Veterinaria La Vaquita Pinta.

## Alcance

- Inicio y cierre de sesión de propietarios.
- Consulta de las mascotas vinculadas a la cuenta.
- Historial de consultas, vacunaciones y desparasitaciones.
- Sin edición de expedientes, pacientes ni tratamientos.

El portal no contiene base de datos, certificados, credenciales ni código del sistema clínico.

## Conexión con VetCare

`vercel.json` redirige las llamadas `/api/v1/portal/*` al servicio central de VetCare. Por ello el navegador conserva un único origen para el portal y su cookie de sesión queda aislada bajo esa ruta.

Antes de hacer público el portal deben cumplirse estas condiciones en el repositorio VetCare:

1. Desplegar la rama que incorpora `/api/v1/portal/*` y la migración `010_owner_portal_sessions`.
2. En las variables de entorno del proyecto central de Vercel, definir `PORTAL_ORIGIN` con la URL HTTPS exacta del portal, sin `/` final.
3. Volver a desplegar el servicio central.

No agregues variables `DB_*`, certificados ni claves privadas a este proyecto.

## Despliegue en Vercel

1. Importa `PrisCortes/VetCare_Portal` como un proyecto nuevo.
2. Selecciona **Other** como Framework Preset y deja el directorio raíz en `/`.
3. Despliega el portal para obtener su URL HTTPS.
4. Configura esa URL como `PORTAL_ORIGIN` en el proyecto central.
5. Comprueba el inicio de sesión con una cuenta de propietario creada desde VetCare.

Si el origen central cambia a un dominio propio, actualiza el destino de `vercel.json` y vuelve a desplegar este proyecto.

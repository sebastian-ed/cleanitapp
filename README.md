# Clean It | Web app de diluciones y fichas técnicas

Web app mobile-first para que los operarios consulten productos, dosis, tablas de preparación, formas de uso y precauciones críticas. Incluye una vista pública y un panel admin con login para editar productos, diluciones y permisos.

## Qué incluye

- `index.html`: vista pública para operarios.
- `admin.html`: panel de administración.
- `styles.css`: UI responsive mobile-first.
- `app.js`: lógica pública, búsqueda, filtros, calculadora y fichas.
- `admin.js`: login, CRUD de productos, carga inicial, permisos admin y cambio de contraseña.
- `data.js`: productos iniciales extraídos de las fichas técnicas cargadas.
- `config.js`: credenciales de Supabase y configuración general.
- `docs/`: fichas técnicas PDF incluidas para abrir desde la app.
- `supabase/schema.sql`: base de datos, RLS, perfiles admin y políticas de seguridad.

## Modo rápido para probar sin backend

1. Subí la carpeta a GitHub Pages o abrí `index.html` localmente.
2. La vista pública funciona con los productos iniciales guardados en `localStorage`.
3. Para entrar al panel admin en modo demo:
   - Email: `admin@local`
   - Contraseña: `admin123`

Ese modo local sirve para validar la UI. No sirve como sistema real de administración porque cualquier dato queda en el navegador del dispositivo.

## Configuración recomendada con Supabase

### 1. Crear proyecto

Creá un proyecto en Supabase y copiá:

- Project URL
- anon public key

### 2. Ejecutar el SQL

En Supabase, entrá a SQL Editor y ejecutá completo:

```sql
supabase/schema.sql
```

Eso crea:

- `products`
- `admin_profiles`
- políticas RLS
- trigger que crea un perfil pendiente cuando alguien se registra

### 3. Configurar `config.js`

Abrí `config.js` y pegá tus credenciales:

```js
window.APP_CONFIG = {
  APP_NAME: 'Clean It | Diluciones',
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY',
  DEFAULT_VOLUME_MODE: 'water',
  CONTACTS: { /* ... */ }
};
```

### 4. Crear tu primer admin

1. Abrí `admin.html`.
2. Creá tu cuenta con email y contraseña.
3. En Supabase SQL Editor ejecutá, reemplazando el email:

```sql
update public.admin_profiles
set status = 'approved', role = 'superadmin'
where email = 'TU_EMAIL_ADMIN@DOMINIO.COM';
```

4. Volvé a `admin.html` e ingresá.

### 5. Cargar productos iniciales

En el panel admin, pestaña `Setup`, tocá:

`Cargar productos iniciales en Supabase`

Desde ese momento la vista pública lee los productos activos desde Supabase.

## Permisos admin

- Un usuario nuevo se registra desde `admin.html`.
- Queda con estado `pending`.
- Un superadmin lo aprueba desde la pestaña `Admins`.
- Los admins aprobados pueden editar productos.
- Solo el superadmin debería aprobar otros admins.

## Cómo calcula la app

La base por defecto es la ficha técnica: `ml de producto por litro de agua`.

Ejemplo: si la ficha dice `25 ml en 1 litro de agua`, para 5 litros de agua:

```txt
5 × 25 = 125 ml de producto
```

La app también tiene el modo alternativo `Quiero preparar esta cantidad final`, que ajusta el cálculo para que el volumen final sea aproximado al valor cargado.

## Agregar un producto nuevo

Desde el panel admin:

1. Entrá a `Nuevo producto`.
2. Cargá nombre, categoría, tipo, descripción, superficies, instrucciones y precauciones.
3. Si el producto se diluye, agregá cada dilución con:
   - Uso: `Limpieza general`
   - Ratio: `1:40`
   - ml/L: `25`
4. Si es listo para usar, marcá `Sí, no se diluye`.
5. Guardá.

## Notas operativas

- Los productos listos para usar no generan cálculo de dilución.
- Las precauciones críticas están visibles en tarjetas y en ficha completa.
- No se debe mezclar productos salvo que la ficha técnica y el protocolo interno lo indiquen de forma explícita.
- Ante duda, prevalece la ficha técnica original del fabricante.

## Deploy en GitHub Pages

1. Subí todos los archivos a un repositorio.
2. En GitHub: `Settings > Pages`.
3. Elegí la rama `main` y carpeta `/root`.
4. Guardá.
5. Abrí la URL publicada.

## Deploy en Netlify

1. Entrá a Netlify.
2. Arrastrá la carpeta completa.
3. Esperá el deploy.
4. Configurá Supabase Auth con la URL final del sitio.

## Supabase Auth URL

En Supabase:

`Authentication > URL Configuration`

Agregá como Site URL la URL de tu app. Si usás GitHub Pages o Netlify, agregá también esa URL en Redirect URLs.

## Seguridad mínima recomendada

- Cambiar la contraseña inicial desde el panel.
- Usar Supabase para producción.
- No dejar el proyecto en modo local para operación real.
- Aprobar manualmente cada admin.
- No publicar la service role key. Solo va la anon public key.

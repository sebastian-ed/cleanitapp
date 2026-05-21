# Clean It | Web app de diluciones y fichas técnicas

Web app mobile-first para que los operarios consulten productos, dosis, tablas de preparación, formas de uso y precauciones críticas. Incluye vista pública y panel admin con login Supabase para editar productos, diluciones y permisos.

## Qué incluye

- `index.html`: vista pública para operarios.
- `admin.html`: panel de administración.
- `styles.css`: UI responsive mobile-first.
- `app.js`: lógica pública, búsqueda, filtros, calculadora y fichas.
- `admin.js`: login, CRUD de productos, carga de catálogo, permisos admin y cambio de contraseña.
- `data.js`: catálogo base extraído de las fichas técnicas cargadas.
- `config.js`: credenciales de Supabase y configuración general.
- `docs/`: fichas técnicas PDF incluidas para abrir desde la app.
- `supabase/schema.sql`: base de datos, RLS, perfiles admin y políticas de seguridad.
- `supabase/upsert_new_products.sql`: script para insertar/actualizar solo los productos agregados en esta versión.

## Productos agregados en esta versión

- RAPID PLUS GEL CON LAVANDINA: listo para usar.
- BIO-ULTRA: diluciones 1:20, 1:30 y 1:50.
- STEEL SHINE: listo para usar.
- WOOD: listo para usar.

## Configuración con Supabase

Esta versión no usa modo local. Si `config.js` no tiene credenciales Supabase, la app no va a operar.

### 1. Conservar credenciales

Si ya tenés la app funcionando, copiá tus valores actuales de `config.js` antes de reemplazar archivos:

```js
window.APP_CONFIG = {
  APP_NAME: 'Clean It | Diluciones',
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY',
  DEFAULT_VOLUME_MODE: 'water',
  CONTACTS: { /* ... */ }
};
```

La `anon public key` puede estar en front-end. No publiques la `service_role key`.

### 2. Si instalás desde cero

En Supabase SQL Editor, ejecutá:

```sql
supabase/schema.sql
```

Eso crea:

- `products`
- `admin_profiles`
- políticas RLS
- trigger que crea un perfil pendiente cuando alguien se registra

### 3. Primer admin

1. Abrí `admin.html`.
2. Creá tu cuenta con email y contraseña.
3. En Supabase SQL Editor ejecutá, reemplazando el email:

```sql
update public.admin_profiles
set status = 'approved', role = 'superadmin'
where email = 'TU_EMAIL_ADMIN@DOMINIO.COM';
```

4. Volvé a `admin.html` e ingresá.

## Cómo cargar los productos nuevos

### Opción A — Desde el panel admin

Entrá a:

`Admin > Setup > Cargar solo productos nuevos`

Ese botón toma únicamente los productos definidos en `window.NEW_PRODUCT_IDS` dentro de `data.js` y los inserta/actualiza en Supabase.

### Opción B — Desde SQL

Si preferís hacerlo directo en Supabase, ejecutá:

```sql
supabase/upsert_new_products.sql
```

Este script inserta/actualiza solo:

- `rapid-plus-gel-lavandina`
- `bio-ultra`
- `steel-shine`
- `wood`

## Catálogo completo

En `Admin > Setup` también existe:

`Actualizar catálogo completo`

Usalo con criterio. Hace `upsert` de todos los productos base de `data.js`. Si ya editaste productos manualmente desde el panel, puede sobrescribir esos campos. Para una base existente, conviene usar primero `Cargar solo productos nuevos`.

## Permisos admin

- Un usuario nuevo se registra desde `admin.html`.
- Queda con estado `pending`.
- Un superadmin lo aprueba desde la pestaña `Admins`.
- Los admins aprobados pueden editar productos.
- Solo un superadmin debería aprobar otros admins.

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
- No se deben mezclar productos salvo indicación explícita de la ficha técnica y del protocolo interno.
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

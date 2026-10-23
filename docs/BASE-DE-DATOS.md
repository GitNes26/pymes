# Base de datos

- Motor: **MySQL 8** (compatible MariaDB). Charset `utf8mb4`, collation `utf8mb4_unicode_ci`.
- Conexión por variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (ver `.env.example`).
- Local (Windows): `127.0.0.1:3307`, arrancar con `tools/start-mysql.ps1`.

## Esquema y migraciones

- `db.js` crea tablas y agrega columnas faltantes **al arrancar** (idempotente). El SQL está en dialecto SQLite y `db-maria-sync.js` lo traduce (`AUTOINCREMENT`→`AUTO_INCREMENT`, `INSERT OR IGNORE`→`INSERT IGNORE`, `RANDOM()`→`RAND()`…).
- `catamanager-full.sql`: esquema limpio para instalaciones nuevas (lo usa `docker-compose.yml`). **Mantenlo al día.**
- `catamanager-con-datos.sql`: dump con datos — **no se versiona**.

## Regla para cambios de esquema

Cada cambio de BD incluye:

1. Migración en `db.js`.
2. Script **MySQL 8** listo para correr en el servidor, en `docs/sql/AAAA-MM-DD-descripcion.sql`, idempotente cuando sea posible. Plantilla:

```sql
-- docs/sql/2026-10-20-ejemplo.sql
-- Descripción: agrega columna X a products
USE catamanager;

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'x');
SET @sql := IF(@existe = 0, 'ALTER TABLE products ADD COLUMN x TEXT NULL', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
```

3. Actualizar `catamanager-full.sql`.

Antes de correr un script en producción: respaldo con `mysqldump -u USUARIO -p catamanager > respaldo-AAAA-MM-DD.sql`.

## Tablas principales

`businesses` (tiendas, diseño, plan), `products`, `categories`, grupos de categorías, atributos/variantes, `orders`, clientes, proveedores y compras, empleados y permisos, `price_history`. Lista completa de columnas: ver `catamanager-full.sql`.

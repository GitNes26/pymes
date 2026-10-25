-- =============================================================================
-- 2026-10-25 · Seguimiento de pedidos para el cliente
-- Agrega a `orders`:
--   track_token    parte secreta del enlace /:slug/seguimiento/<id>-<token>
--   fulfillment    etapa de entrega: '' (recibido) | preparando | en_camino | listo
--   fulfillment_at cuándo cambió la etapa
-- Idempotente: se puede correr más de una vez (si la columna ya existe, la salta).
-- MySQL 8. Antes de correrlo: mysqldump -u USUARIO -p catamanager > respaldo-2026-10-25.sql
-- =============================================================================
USE catamanager;

SET @t := 'orders';

SET @c := 'track_token';
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c) = 0,
  'ALTER TABLE `orders` ADD COLUMN `track_token` TEXT COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4\'\')',
  'SELECT ''track_token ya existe''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := 'fulfillment';
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c) = 0,
  'ALTER TABLE `orders` ADD COLUMN `fulfillment` TEXT COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4\'\')',
  'SELECT ''fulfillment ya existe''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := 'fulfillment_at';
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c) = 0,
  'ALTER TABLE `orders` ADD COLUMN `fulfillment_at` TEXT COLLATE utf8mb4_unicode_ci',
  'SELECT ''fulfillment_at ya existe''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Comprobación
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('track_token', 'fulfillment', 'fulfillment_at');

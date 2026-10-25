-- ============================================================
-- CataManager - Esquema MySQL 8 (generado desde la BD real)
-- Base de datos: catamanager
-- Ejecutar en una BD vacía antes del primer arranque de la app,
-- o montarlo en /docker-entrypoint-initdb.d/ del contenedor MySQL.
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `abonos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `order_id` int NOT NULL,
  `amount` double NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_abo_biz` (`business_id`),
  KEY `idx_abo_ord` (`order_id`),
  CONSTRAINT `fk_abo_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_abo_ord` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `attribute_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `vals` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (_utf8mb4'[]'),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_at_biz` (`business_id`),
  CONSTRAINT `fk_at_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `businesses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatsapp` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `logo` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `banner` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `pin` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'1234'),
  `active` int DEFAULT '1',
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `template` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'clasica'),
  `color` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'blue'),
  `color_hex` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'#2563eb'),
  `show_network` int DEFAULT '0',
  `giro` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `estilo` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'moderno'),
  `color_hex2` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `color_mode` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'degradado'),
  `grid_cols` int DEFAULT '3',
  `plan` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'free'),
  `import_map` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `giros` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `plan_price` double DEFAULT '0',
  `plan_ends_at` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `suspended` int DEFAULT '0',
  `ads_enabled` int DEFAULT '0',
  `bg` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `card` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `text` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `muted` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `border` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `radius` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `font` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `accent` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `accent2` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `header` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `header_text` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `wa_message` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `currency` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'MXN'),
  `sections` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `demo` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `pin_hash` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `horario` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `horario_msg` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `giro_preset` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `onboarding_done` int DEFAULT '0',
  `blocks` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'[]'),
  `page_bg` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `redes` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'{}'),
  `faq` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'[]'),
  `address` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_cat_biz` (`business_id`),
  CONSTRAINT `fk_cat_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9046 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `custom_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `emoji` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'📄'),
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `category` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `giro` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `blocks_json` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'[]'),
  `colors_json` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'{}'),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `active` int DEFAULT '1',
  `is_default` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_cust_biz` (`business_id`),
  CONSTRAINT `fk_cust_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `pin_hash` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `perms` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'[]'),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_emp_biz` (`business_id`),
  CONSTRAINT `fk_emp_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `giros` (
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used` int DEFAULT '0',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `items` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `total` double NOT NULL,
  `customer_name` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `status` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'nuevo'),
  `paid` int DEFAULT '0',
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `customer_phone` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `is_installment` int DEFAULT '0',
  `installment_paid` double DEFAULT '0',
  `installment_count` int DEFAULT '0',
  `paid_at` text COLLATE utf8mb4_unicode_ci,
  `installment_frequency` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'semanal'),
  `track_token` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `fulfillment` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `fulfillment_at` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_ord_biz` (`business_id`),
  CONSTRAINT `fk_ord_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `pages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (_utf8mb4'personalizada'),
  `icon` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `blocks` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'[]'),
  `visible_menu` int DEFAULT '1',
  `active` int DEFAULT '1',
  `sort` int DEFAULT '0',
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pages_biz_slug` (`business_id`,`slug`),
  KEY `idx_pages_biz` (`business_id`),
  CONSTRAINT `fk_pages_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` double DEFAULT '0',
  `days` int DEFAULT '30',
  `max_products` int DEFAULT '-1',
  `ads` int DEFAULT '1',
  `active` int DEFAULT '1',
  `design` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=114 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `page_id` int DEFAULT NULL,
  `title` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `image` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `published_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `active` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_posts_biz` (`business_id`),
  KEY `idx_posts_page` (`page_id`),
  CONSTRAINT `fk_posts_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_posts_page` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `price_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `name` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `price` double DEFAULT '0',
  `old_price` double DEFAULT NULL,
  `promo_type` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `promo_gift` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_ph_biz` (`business_id`),
  CONSTRAINT `fk_ph_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` double NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `image` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `active` int DEFAULT '1',
  `sort` int DEFAULT '0',
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `old_price` double DEFAULT NULL,
  `featured` int DEFAULT '0',
  `stock` int DEFAULT NULL,
  `variants` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `promo_ends_at` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `galeria` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `promo_type` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `promo_value` double DEFAULT '0',
  `promo_gift` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `sku` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `tags` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `video` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `specs` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `barcode` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `allow_installments` int DEFAULT '0',
  `installment_count` int DEFAULT '6',
  `installment_min_down` double DEFAULT '0',
  `installment_frequency` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'semanal'),
  PRIMARY KEY (`id`),
  KEY `idx_prod_biz` (`business_id`),
  KEY `idx_prod_cat` (`category_id`),
  CONSTRAINT `fk_prod_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_prod_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10899 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `supplier_id` int DEFAULT NULL,
  `items` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `total` double DEFAULT '0',
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `received` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_po_biz` (`business_id`),
  CONSTRAINT `fk_po_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `sessions` (
  `token` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `biz_id` int DEFAULT NULL,
  `kind` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'owner'),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `emp_id` int DEFAULT NULL,
  `expires_at` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `site_config` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  `email` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  PRIMARY KEY (`id`),
  KEY `idx_sup_biz` (`business_id`),
  CONSTRAINT `fk_sup_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `type` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4''),
  `created_at` text COLLATE utf8mb4_unicode_ci DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_trk_biz` (`business_id`),
  CONSTRAINT `fk_trk_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2601 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



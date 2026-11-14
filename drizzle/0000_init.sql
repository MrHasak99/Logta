CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watchlist_id` integer NOT NULL,
	`price_observation_id` integer NOT NULL,
	`triggered_at` integer NOT NULL,
	`seen` integer DEFAULT false NOT NULL,
	`message_en` text NOT NULL,
	`message_ar` text NOT NULL,
	FOREIGN KEY (`watchlist_id`) REFERENCES `watchlist`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`price_observation_id`) REFERENCES `price_observations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`price_volatility` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`qty` real DEFAULT 1 NOT NULL,
	`allow_substitute` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `list_items_list_idx` ON `list_items` (`list_id`);--> statement-breakpoint
CREATE TABLE `pending_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alias_normalized` text NOT NULL,
	`example_raw_text` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`seen_count` integer DEFAULT 1 NOT NULL,
	`distinct_users` integer DEFAULT 0 NOT NULL,
	`distinct_stores` integer DEFAULT 0 NOT NULL,
	`user_ids_json` text DEFAULT '[]' NOT NULL,
	`store_ids_json` text DEFAULT '[]' NOT NULL,
	`proposed_name_en` text,
	`proposed_name_ar` text,
	`proposed_category_id` integer,
	`promoted_product_id` integer,
	FOREIGN KEY (`proposed_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_products_alias_normalized_unique` ON `pending_products` (`alias_normalized`);--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`store_id` integer NOT NULL,
	`price_kwd` real NOT NULL,
	`observed_at` integer NOT NULL,
	`evidence` text NOT NULL,
	`seed_source` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`is_promo` integer DEFAULT false NOT NULL,
	`receipt_line_id` integer,
	`user_id` integer,
	`status` text DEFAULT 'accepted' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_line_id`) REFERENCES `receipt_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `obs_product_store_time_idx` ON `price_observations` (`product_id`,`store_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `obs_status_idx` ON `price_observations` (`status`);--> statement-breakpoint
CREATE TABLE `product_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`alias_text` text NOT NULL,
	`alias_normalized` text NOT NULL,
	`lang` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`store_id` integer,
	`last_seen_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `aliases_normalized_idx` ON `product_aliases` (`alias_normalized`);--> statement-breakpoint
CREATE INDEX `aliases_product_idx` ON `product_aliases` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `aliases_unique_idx` ON `product_aliases` (`product_id`,`alias_normalized`,`store_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`brand` text,
	`category_id` integer NOT NULL,
	`size_value` real NOT NULL,
	`size_unit` text NOT NULL,
	`pack_count` integer DEFAULT 1 NOT NULL,
	`base_qty_for_unit_price` real NOT NULL,
	`substitute_group` text,
	`barcode` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_from` text DEFAULT 'seed' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_subgroup_idx` ON `products` (`substitute_group`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `receipt_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`receipt_id` integer NOT NULL,
	`raw_text` text NOT NULL,
	`qty` real DEFAULT 1 NOT NULL,
	`unit_price_kwd` real,
	`line_total_kwd` real,
	`matched_product_id` integer,
	`match_method` text NOT NULL,
	`match_confidence` real DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipt_lines_receipt_idx` ON `receipt_lines` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`store_id` integer,
	`store_text_raw` text,
	`purchased_at` integer,
	`uploaded_at` integer NOT NULL,
	`image_deleted` integer DEFAULT true NOT NULL,
	`total_kwd` real,
	`status` text NOT NULL,
	`llm_model` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`type` text NOT NULL,
	`area_en` text,
	`area_ar` text,
	`lat` real,
	`lng` real,
	`delivery_fee_kwd` real,
	`min_order_kwd` real,
	`coords_approximate` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_slug_unique` ON `stores` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`home_lat` real,
	`home_lng` real,
	`contribution_count` integer DEFAULT 0 NOT NULL,
	`trust_weight` real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`target_price_kwd` real NOT NULL,
	`created_at` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `watchlist_product_idx` ON `watchlist` (`product_id`);
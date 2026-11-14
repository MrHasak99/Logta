ALTER TABLE `pending_products` ADD `proposed_brand` text;--> statement-breakpoint
ALTER TABLE `pending_products` ADD `proposed_size_value` real;--> statement-breakpoint
ALTER TABLE `pending_products` ADD `proposed_size_unit` text;--> statement-breakpoint
ALTER TABLE `users` ADD `device_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_device_id_unique` ON `users` (`device_id`);
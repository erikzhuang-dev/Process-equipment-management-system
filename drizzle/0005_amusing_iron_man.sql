CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`contactName` varchar(120),
	`phone` varchar(64),
	`email` varchar(160),
	`address` varchar(300),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `equipment` ADD `supplierId` int;--> statement-breakpoint
CREATE INDEX `supplier_name_index` ON `suppliers` (`name`);
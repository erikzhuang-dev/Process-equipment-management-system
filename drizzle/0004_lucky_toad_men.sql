CREATE TABLE `business_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_units_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `factories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`location` varchar(160),
	`businessUnitId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `factories_id` PRIMARY KEY(`id`),
	CONSTRAINT `factories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `equipment` ADD `businessUnitId` int;--> statement-breakpoint
ALTER TABLE `equipment` ADD `factoryId` int;
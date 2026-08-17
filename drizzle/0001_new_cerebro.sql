CREATE TABLE `equipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`model` varchar(120) NOT NULL,
	`specification` varchar(200) NOT NULL,
	`process` varchar(120) NOT NULL,
	`location` varchar(160) NOT NULL,
	`status` enum('running','stopped','maintenance','scrapped') NOT NULL DEFAULT 'running',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipment_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipment_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `equipment_status_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`fromStatus` enum('running','stopped','maintenance','scrapped'),
	`toStatus` enum('running','stopped','maintenance','scrapped') NOT NULL,
	`changedBy` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `equipment_status_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`description` text NOT NULL,
	`discoveredAt` timestamp NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`status` enum('open','in_repair','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partId` int NOT NULL,
	`transactionType` enum('inbound','outbound') NOT NULL,
	`quantity` int NOT NULL,
	`operatorId` int,
	`operatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`cycleDays` int NOT NULL,
	`maintenanceContent` text NOT NULL,
	`nextScheduledAt` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_work_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`planId` int NOT NULL,
	`executor` varchar(120),
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`scheduledAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`maintenanceContent` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_work_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`module` varchar(80) NOT NULL,
	`action` varchar(80) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(64),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`specification` varchar(200) NOT NULL,
	`stockQuantity` int NOT NULL DEFAULT 0,
	`safetyStock` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repair_work_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faultId` int NOT NULL,
	`equipmentId` int NOT NULL,
	`technician` varchar(120),
	`repairContent` text,
	`repairCost` decimal(12,2) NOT NULL DEFAULT '0',
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `repair_work_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `equipment_status_index` ON `equipment` (`status`);--> statement-breakpoint
CREATE INDEX `status_change_equipment_index` ON `equipment_status_changes` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `fault_equipment_index` ON `faults` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `inventory_transaction_part_index` ON `inventory_transactions` (`partId`);--> statement-breakpoint
CREATE INDEX `maintenance_plan_equipment_index` ON `maintenance_plans` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `maintenance_work_order_equipment_index` ON `maintenance_work_orders` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `maintenance_work_order_plan_index` ON `maintenance_work_orders` (`planId`);--> statement-breakpoint
CREATE INDEX `operation_log_created_index` ON `operation_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `parts_name_index` ON `parts` (`name`);--> statement-breakpoint
CREATE INDEX `repair_work_order_fault_index` ON `repair_work_orders` (`faultId`);--> statement-breakpoint
CREATE INDEX `repair_work_order_equipment_index` ON `repair_work_orders` (`equipmentId`);
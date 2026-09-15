CREATE TABLE `acceptance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applyType` enum('change','purchase') NOT NULL,
	`applyId` int NOT NULL,
	`result` enum('pass','fail') NOT NULL,
	`remark` text,
	`photos` text,
	`signerId` int,
	`signerName` varchar(120),
	`coSignerName` varchar(120),
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acceptance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `apply_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(60) NOT NULL,
	`settingValue` varchar(120) NOT NULL,
	`label` varchar(160) NOT NULL,
	`unit` varchar(40),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apply_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `apply_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `apply_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`roleKey` enum('applicant','equipment_admin','engineer','manager','bu_owner','gm','purchaser','system_admin') NOT NULL,
	`buId` int,
	`email` varchar(160),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apply_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_flow_defs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`flowKey` varchar(40) NOT NULL,
	`flowName` varchar(120) NOT NULL,
	`chainJson` text NOT NULL,
	`description` varchar(300),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_flow_defs_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_flow_defs_flowKey_unique` UNIQUE(`flowKey`)
);
--> statement-breakpoint
CREATE TABLE `approval_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applyType` enum('change','purchase') NOT NULL,
	`applyId` int NOT NULL,
	`nodeKey` varchar(40) NOT NULL,
	`nodeName` varchar(120) NOT NULL,
	`action` enum('approve','reject','resubmit','submit','withdraw','urge','execute','accept','close') NOT NULL,
	`actorId` int NOT NULL,
	`actorName` varchar(120),
	`actorRole` varchar(40),
	`comment` text,
	`actedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `change_applies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applyNo` varchar(40) NOT NULL,
	`equipmentId` int NOT NULL,
	`changeType` enum('repair','calib','retrofit','transfer','scrap') NOT NULL,
	`status` enum('submitted','approving','approved','executing','pending_acceptance','closed','withdrawn','rejected') NOT NULL DEFAULT 'submitted',
	`currentNode` varchar(40),
	`title` varchar(200) NOT NULL,
	`reason` text NOT NULL,
	`planDetail` text NOT NULL,
	`photos` text,
	`estimatedFee` decimal(14,2) NOT NULL DEFAULT '0',
	`urgency` enum('normal','production','shutdown') NOT NULL DEFAULT 'normal',
	`preLockStatus` enum('running','stopped','maintenance','calibrating','pending_acceptance','scrapped'),
	`targetBuId` int,
	`targetLocation` varchar(160),
	`flowChain` text NOT NULL,
	`nodeEnteredAt` timestamp NOT NULL DEFAULT (now()),
	`submitterId` int NOT NULL,
	`submitterName` varchar(120),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `change_applies_id` PRIMARY KEY(`id`),
	CONSTRAINT `change_applies_applyNo_unique` UNIQUE(`applyNo`),
	CONSTRAINT `change_apply_no_unique` UNIQUE(`applyNo`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`recordType` enum('repair','calib','retrofit','inspection') NOT NULL DEFAULT 'repair',
	`applyId` int,
	`applyNo` varchar(40),
	`content` text NOT NULL,
	`laborHours` decimal(8,1),
	`fee` decimal(14,2) NOT NULL DEFAULT '0',
	`executorName` varchar(120),
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` varchar(500),
	`link` varchar(200),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_applies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applyNo` varchar(40) NOT NULL,
	`buyType` enum('new_purchase','replace','capacity_expansion') NOT NULL,
	`status` enum('submitted','approving','approved','executing','pending_acceptance','closed','withdrawn','rejected') NOT NULL DEFAULT 'submitted',
	`currentNode` varchar(40),
	`title` varchar(200) NOT NULL,
	`reason` text NOT NULL,
	`buId` int,
	`replaceEquipmentId` int,
	`equipmentName` varchar(160) NOT NULL,
	`modelSpec` varchar(200),
	`quantity` int NOT NULL DEFAULT 1,
	`budget` decimal(14,2) NOT NULL DEFAULT '0',
	`urgency` enum('normal','production','shutdown') NOT NULL DEFAULT 'normal',
	`expectedDate` timestamp,
	`flowChain` text NOT NULL,
	`nodeEnteredAt` timestamp NOT NULL DEFAULT (now()),
	`purchaserStage` enum('pending','quoting','quoted','ordered','shipping','arrived') DEFAULT 'pending',
	`selectedQuotationId` int,
	`selectedSupplierName` varchar(160),
	`selectedAmount` decimal(14,2),
	`submitterId` int NOT NULL,
	`submitterName` varchar(120),
	`closedAt` timestamp,
	`newEquipmentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_applies_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_applies_applyNo_unique` UNIQUE(`applyNo`),
	CONSTRAINT `purchase_apply_no_unique` UNIQUE(`applyNo`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applyId` int NOT NULL,
	`supplierId` int,
	`supplierName` varchar(160) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`leadTimeDays` int,
	`paymentTerm` varchar(120),
	`attachmentNote` varchar(300),
	`isSelected` boolean NOT NULL DEFAULT false,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `equipment` MODIFY COLUMN `status` enum('running','stopped','maintenance','calibrating','pending_acceptance','scrapped') NOT NULL DEFAULT 'running';--> statement-breakpoint
ALTER TABLE `equipment_status_changes` MODIFY COLUMN `fromStatus` enum('running','stopped','maintenance','calibrating','pending_acceptance','scrapped');--> statement-breakpoint
ALTER TABLE `equipment_status_changes` MODIFY COLUMN `toStatus` enum('running','stopped','maintenance','calibrating','pending_acceptance','scrapped') NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment` ADD `ownerBuNote` varchar(120);--> statement-breakpoint
ALTER TABLE `equipment` ADD `calibDueDate` timestamp;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `licenseNo` varchar(120);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `qualifications` text;--> statement-breakpoint
CREATE INDEX `acceptance_record_apply_index` ON `acceptance_records` (`applyType`,`applyId`);--> statement-breakpoint
CREATE INDEX `apply_user_role_index` ON `apply_users` (`roleKey`);--> statement-breakpoint
CREATE INDEX `approval_record_apply_index` ON `approval_records` (`applyType`,`applyId`);--> statement-breakpoint
CREATE INDEX `approval_record_actor_index` ON `approval_records` (`actorId`);--> statement-breakpoint
CREATE INDEX `change_apply_status_index` ON `change_applies` (`status`);--> statement-breakpoint
CREATE INDEX `change_apply_equipment_index` ON `change_applies` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `change_apply_submitter_index` ON `change_applies` (`submitterId`);--> statement-breakpoint
CREATE INDEX `maintenance_record_equipment_index` ON `maintenance_records` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `notification_user_index` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `purchase_apply_status_index` ON `purchase_applies` (`status`);--> statement-breakpoint
CREATE INDEX `purchase_apply_submitter_index` ON `purchase_applies` (`submitterId`);--> statement-breakpoint
CREATE INDEX `quotation_apply_index` ON `quotations` (`applyId`);
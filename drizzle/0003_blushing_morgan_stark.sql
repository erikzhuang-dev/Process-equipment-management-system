ALTER TABLE `equipment` ADD `supplier` varchar(160);--> statement-breakpoint
ALTER TABLE `equipment` ADD `hourlyCapacity` int;--> statement-breakpoint
ALTER TABLE `equipment` ADD `oee` decimal(6,4);--> statement-breakpoint
ALTER TABLE `equipment` ADD `lowOeeReason` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `energyConsumption` decimal(12,3);--> statement-breakpoint
ALTER TABLE `equipment` ADD `quantity` int;--> statement-breakpoint
ALTER TABLE `equipment` ADD `unitPrice` decimal(14,2);--> statement-breakpoint
ALTER TABLE `equipment` ADD `depreciationYears` int;--> statement-breakpoint
ALTER TABLE `equipment` ADD `lossFactor` decimal(8,4);--> statement-breakpoint
ALTER TABLE `equipment` ADD `investmentIncluded` boolean;--> statement-breakpoint
ALTER TABLE `equipment` ADD `notes` text;
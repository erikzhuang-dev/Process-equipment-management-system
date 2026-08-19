ALTER TABLE `equipment` ADD `assetCategory` varchar(80);--> statement-breakpoint
ALTER TABLE `equipment` ADD `criticality` varchar(8);--> statement-breakpoint
ALTER TABLE `equipment` ADD `responsibleOwner` varchar(120);--> statement-breakpoint
ALTER TABLE `equipment` ADD `commissionedAt` timestamp;--> statement-breakpoint
ALTER TABLE `equipment` ADD `warrantyExpiresAt` timestamp;
ALTER TABLE `maintenance_work_orders` MODIFY COLUMN `planId` int;--> statement-breakpoint
ALTER TABLE `repair_work_orders` MODIFY COLUMN `faultId` int;
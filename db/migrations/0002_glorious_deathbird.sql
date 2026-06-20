ALTER TABLE `modules` ADD `code` text;--> statement-breakpoint
ALTER TABLE `modules` ADD `required_hours` integer;--> statement-breakpoint
ALTER TABLE `modules` ADD `kind` text DEFAULT 'classroom' NOT NULL;--> statement-breakpoint
ALTER TABLE `modules` ADD `exam_gate` text;
CREATE TABLE `user_files` (
	`app_id` varchar(36) NOT NULL,
	`file_id` varchar(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	CONSTRAINT PRIMARY KEY(`app_id`,`file_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role` varchar(16) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- 先允许空值并回填，再加非空及唯一约束，兼容已有账号
ALTER TABLE `users` ADD `dify_user_id` varchar(128);--> statement-breakpoint
UPDATE `users` SET `dify_user_id` = CONCAT('hub_', `id`);--> statement-breakpoint
-- 上游最早创建的账号来自初始化页面，保留其管理员权限
UPDATE `users` SET `role` = 'admin' ORDER BY `created_at`, `id` LIMIT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY `dify_user_id` varchar(128) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_dify_user_id_key` ON `users` (`dify_user_id`);
-- DropForeignKey
ALTER TABLE `SyncLog` DROP FOREIGN KEY `SyncLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `SyncLog` DROP FOREIGN KEY `SyncLog_playlistId_fkey`;

-- AlterColumn
ALTER TABLE `SyncLog` MODIFY `userId` VARCHAR(191) NULL;

-- AlterColumn
ALTER TABLE `SyncLog` MODIFY `playlistId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `SyncLog` ADD CONSTRAINT `SyncLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SyncLog` ADD CONSTRAINT `SyncLog_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

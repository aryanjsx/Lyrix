-- CreateTable
CREATE TABLE `TrackLyrics` (
    `id` VARCHAR(191) NOT NULL,
    `trackId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `hasSync` BOOLEAN NOT NULL DEFAULT false,
    `rawLyrics` LONGTEXT NULL,
    `lrcContent` LONGTEXT NULL,
    `snippet` TEXT NULL,
    `isPartial` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(191) NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrackLyrics_trackId_key`(`trackId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LyricsApiQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` VARCHAR(191) NOT NULL,
    `units` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LyricsApiQuota_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrackLyrics` ADD CONSTRAINT `TrackLyrics_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `Track`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add channelId to Track
ALTER TABLE `Track` ADD COLUMN `channelId` VARCHAR(191) NULL;

-- CreateTable: TrackGenre
CREATE TABLE `TrackGenre` (
    `id` VARCHAR(191) NOT NULL,
    `trackId` VARCHAR(191) NOT NULL,
    `genre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TrackGenre_trackId_genre_key`(`trackId`, `genre`),
    INDEX `TrackGenre_genre_idx`(`genre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: UserGenreProfile
CREATE TABLE `UserGenreProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `genre` VARCHAR(191) NOT NULL,
    `playCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `UserGenreProfile_userId_genre_key`(`userId`, `genre`),
    INDEX `UserGenreProfile_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: UserArtistProfile
CREATE TABLE `UserArtistProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `channelName` VARCHAR(191) NOT NULL,
    `playCount` INTEGER NOT NULL DEFAULT 0,
    `totalSeconds` INTEGER NOT NULL DEFAULT 0,
    `lastPlayed` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserArtistProfile_userId_channelId_key`(`userId`, `channelId`),
    INDEX `UserArtistProfile_userId_idx`(`userId`),
    INDEX `UserArtistProfile_channelId_idx`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: SmartMix
CREATE TABLE `SmartMix` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `mixType` VARCHAR(191) NOT NULL,
    `trackIds` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `SmartMix_userId_idx`(`userId`),
    INDEX `SmartMix_mixType_idx`(`mixType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: RecommendationCache
CREATE TABLE `RecommendationCache` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL DEFAULT '',
    `trackIds` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RecommendationCache_userId_sourceType_sourceId_key`(`userId`, `sourceType`, `sourceId`),
    INDEX `RecommendationCache_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrackGenre` ADD CONSTRAINT `TrackGenre_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `Track`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGenreProfile` ADD CONSTRAINT `UserGenreProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserArtistProfile` ADD CONSTRAINT `UserArtistProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmartMix` ADD CONSTRAINT `SmartMix_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

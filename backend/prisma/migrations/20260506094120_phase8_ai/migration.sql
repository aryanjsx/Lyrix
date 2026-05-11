-- AlterTable
ALTER TABLE `User` ADD COLUMN `abTestGroup` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ModelVersion` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `algorithm` VARCHAR(191) NOT NULL,
    `trainedAt` DATETIME(3) NOT NULL,
    `dataPoints` INTEGER NOT NULL,
    `precision` DOUBLE NULL,
    `recall` DOUBLE NULL,
    `ndcg` DOUBLE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ModelVersion_version_key`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecommendationFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `modelVersion` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `positionShown` INTEGER NOT NULL,
    `playedSeconds` INTEGER NOT NULL DEFAULT 0,
    `sessionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecommendationFeedback_userId_idx`(`userId`),
    INDEX `RecommendationFeedback_source_action_idx`(`source`, `action`),
    INDEX `RecommendationFeedback_modelVersion_idx`(`modelVersion`),
    INDEX `RecommendationFeedback_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

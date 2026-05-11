-- CreateIndex
CREATE INDEX `PlayHistory_userId_playedAt_idx` ON `PlayHistory`(`userId`, `playedAt`);

-- CreateIndex
CREATE INDEX `PlayHistory_userId_trackId_idx` ON `PlayHistory`(`userId`, `trackId`);

-- CreateIndex
CREATE INDEX `SmartMix_userId_expiresAt_idx` ON `SmartMix`(`userId`, `expiresAt`);

-- CreateIndex
CREATE INDEX `TrackLyrics_expiresAt_idx` ON `TrackLyrics`(`expiresAt`);

-- CreateIndex
CREATE INDEX `UserArtistProfile_userId_playCount_idx` ON `UserArtistProfile`(`userId`, `playCount`);

-- CreateIndex
CREATE INDEX `UserGenreProfile_userId_playCount_idx` ON `UserGenreProfile`(`userId`, `playCount`);

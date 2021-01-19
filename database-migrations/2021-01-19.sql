-- Generated with adminer
ALTER TABLE "matches"
ADD "is_deleted" boolean NOT NULL DEFAULT false;

-- Set is_deleted to false for ALL existing matches
UPDATE matches
SET is_deleted = false;

-- Soft delete all known faulty matches
UPDATE matches
SET is_deleted = true
WHERE dota_match_id IN (
    '5310965954',
    '5314558866',
    '5314651376',
    '5321557425',
    '5322026529',
    '5394885055',
    '5471079116',
    '5693051343',
    '5693053375',
    '5693144498',
    '5763502972'
);

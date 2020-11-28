-- Generated within Adminer
ALTER TABLE "matches"
ALTER "winning_team_id" TYPE integer,
ALTER "winning_team_id" DROP DEFAULT,
ALTER "winning_team_id" SET NOT NULL,
ADD "first_blood_mock" integer NULL,
ADD "first_blood_praise" smallint NULL;
COMMENT ON COLUMN "matches"."winning_team_id" IS '';
COMMENT ON TABLE "matches" IS '';

-- Add the new tables
CREATE TYPE fb_phrase_type AS ENUM ('mock', 'praise')
CREATE TABLE first_blood_phrases (
    id      SERIAL              PRIMARY KEY,
    phrase  VARCHAR             NOT NULL,
    kind    fb_phrase_type,
)

-- Insert the values currently in the database
INSERT INTO first_blood_phrases (phrase, kind) VALUES
       ('<name> var sämst', 'mock'),
       ('<name> hade en dålig dag', 'mock'),
       ('<name> fokuserade inte tillräckligt', 'mock'),
       ('<name> tappade det fullständigt', 'mock'),
       ('<name> skyllde på lagg', 'mock'),
       ('<name> misslyckades med social distansering', 'mock'),
       ('<name> blev scammad, köpte en fortune 3 träpickaxe', 'mock'),
       ('<name> hittade inte sladden', 'mock'),
       ('<name> borde hållt sig till sin egna runjävel', 'mock'),
       ('<name> försökte sälja bläck till ravvie', 'mock'),
       ('<name> drog inte ut i tid', 'mock'),
       ('"OMG, <name> just went in"', 'mock'),
       ('<name> spydde på sitt tangentbord', 'mock'),
       ('<name> kunde inte dodgea', 'mock'),
       ('<name> lyssnade på Pontus', 'mock'),
       ('<name> kunde inte fiska, halkade i sjön', 'mock'),
       ('<name> hade handikapps-hotkeys', 'mock'),
       ('<name> fastnade i kokaingränden', 'mock');

-- Map the current values for each match and insert
UPDATE matches SET  first_blood_mock = 8  WHERE id = 89 ;
UPDATE matches SET  first_blood_mock = 2  WHERE id = 88 ;
UPDATE matches SET  first_blood_mock = 1  WHERE id = 87 ;
UPDATE matches SET  first_blood_mock = 7  WHERE id = 86 ;
UPDATE matches SET  first_blood_mock = 12 WHERE id = 106;
UPDATE matches SET  first_blood_mock = 7  WHERE id = 105;
UPDATE matches SET  first_blood_mock = 15 WHERE id = 108;
UPDATE matches SET  first_blood_mock = 18 WHERE id = 110;
UPDATE matches SET  first_blood_mock = 7  WHERE id = 112;
UPDATE matches SET  first_blood_mock = 15 WHERE id = 111;
UPDATE matches SET  first_blood_mock = 9  WHERE id = 114;
UPDATE matches SET  first_blood_mock = 15 WHERE id = 113;
UPDATE matches SET  first_blood_mock = 2  WHERE id = 116;
UPDATE matches SET  first_blood_mock = 12 WHERE id = 115;
UPDATE matches SET  first_blood_mock = 14 WHERE id = 118;
UPDATE matches SET  first_blood_mock = 17 WHERE id = 119;
UPDATE matches SET  first_blood_mock = 2  WHERE id = 121;
UPDATE matches SET  first_blood_mock = 16 WHERE id = 122;
UPDATE matches SET  first_blood_mock = 1  WHERE id = 124;
UPDATE matches SET  first_blood_mock = 12 WHERE id = 125;
UPDATE matches SET  first_blood_mock = 13 WHERE id = 126;
UPDATE matches SET  first_blood_mock = 11 WHERE id = 127;
UPDATE matches SET  first_blood_mock = 8  WHERE id = 128;
UPDATE matches SET  first_blood_mock = 9  WHERE id = 129;
UPDATE matches SET  first_blood_mock = 13 WHERE id = 130;
UPDATE matches SET  first_blood_mock = 17 WHERE id = 131;
UPDATE matches SET  first_blood_mock = 1  WHERE id = 132;
UPDATE matches SET  first_blood_mock = 11 WHERE id = 133;
UPDATE matches SET  first_blood_mock = 12 WHERE id = 134;
UPDATE matches SET  first_blood_mock = 14 WHERE id = 135;
UPDATE matches SET  first_blood_mock = 13 WHERE id = 141;
UPDATE matches SET  first_blood_mock = 17 WHERE id = 140;
UPDATE matches SET  first_blood_mock = 18 WHERE id = 142;
UPDATE matches SET  first_blood_mock = 5  WHERE id = 143;
UPDATE matches SET  first_blood_mock = 6  WHERE id = 144;
UPDATE matches SET  first_blood_mock = 16 WHERE id = 145;
UPDATE matches SET  first_blood_mock = 2  WHERE id = 146;
UPDATE matches SET  first_blood_mock = 3  WHERE id = 147;
UPDATE matches SET  first_blood_mock = 3  WHERE id = 153;
UPDATE matches SET  first_blood_mock = 9  WHERE id = 152;
UPDATE matches SET  first_blood_mock = 1  WHERE id = 156;
UPDATE matches SET  first_blood_mock = 6  WHERE id = 157;
UPDATE matches SET  first_blood_mock = 18 WHERE id = 158;
UPDATE matches SET  first_blood_mock = 9  WHERE id = 161;
UPDATE matches SET  first_blood_mock = 10 WHERE id = 162;
UPDATE matches SET  first_blood_mock = 10 WHERE id = 163;

-- DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id         SERIAL         PRIMARY KEY,
  full_name  VARCHAR(80),
  username   VARCHAR(50)    NOT NULL        UNIQUE,
  password   VARCHAR(140)
);

-- DROP TABLE IF EXISTS teams;
CREATE TABLE teams (
  id         SERIAL          PRIMARY KEY,
  name       VARCHAR(90)
);

-- A team table should exists later where name & etc. belong
-- DROP TABLE IF EXISTS team_players;
CREATE TABLE team_players (
  team_id     INT,
  user_id     INT,
  FOREIGN KEY (team_id) REFERENCES teams (id)
          ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE
);

-- There could be a single teams column with a CSV list of team ID's
-- DROP TABLE IF EXISTS matches;
CREATE TABLE matches (
  id               SERIAL       PRIMARY KEY,
  date             TIMESTAMP,
  score            VARCHAR(40),
  winning_team_id  INT,
  league_id        INT,
  dota_match_id    VARCHAR,
  died_first_blood INT -- TODO: References user.id
);

-- DROP TABLE IF EXISTS match_teams;
CREATE TABLE match_teams (
  match_id INT,
  team_id  INT,
  -- TODO: Score here instead?
  name     TEXT, -- Optional
  PRIMARY KEY (match_id, team_id),
  FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
);


-- DROP TABLE IF EXISTS user_match_stats;
CREATE TABLE user_match_stats (
       user_id INT,
       match_id INT,
       kills INT,
       deaths INT,
       assists INT,
       observers_placed INT,
       observers_destroyed INT,
       sentries_placed INT,
       sentries_destroyed INT,
       PRIMARY KEY (user_id, match_id),
       FOREIGN KEY (user_id) REFERENCES users (id)
               ON DELETE SET NULL ON UPDATE CASCADE,
       FOREIGN KEY (match_id) REFERENCES matches (id)
               ON DELETE CASCADE ON UPDATE CASCADE
);

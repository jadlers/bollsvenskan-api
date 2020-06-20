/*
 * Pure functions for calculating updating ELO rating and using it to
 * balance teams.
 *
 * Rewrite off @ninyya's python implementation
 */

/**
 * Probablility for rating1 winning over rating2
 */
function probability(rating1, rating2) {
  return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
}

/**
 * Function will return the updated ratings for the first rating when playing against the second rating
 * FIDE uses the following ranges for K:
 *
 * K = 40, for a player new to the rating list until the completion of events
 * with a total of 30 games and for all players until their 18th birthday, as
 * long as their rating remains under 2300.
 *
 * K = 20, for players with a rating always under 2400.
 *
 * K = 10, for players with any published rating of at least 2400 and at least
 * 30 games played in previous events. Thereafter it remains permanently at 10.

 * @param currentRating: number. Average rating of team for player to update
 * @param opponentRating: number. Average rating of opponent team in match played
 * @param win: boolean. True if currentRating won, false otherwise
 * @param numberOfGames: number. Number of games the player has played
 */
export function ratingDiff(currentRating, opponentRating, win, numberOfGames) {
  let k = 30;
  if (numberOfGames <= 25) k = 50;
  if (numberOfGames <= 10) k = 100;

  const winVal = win ? 1.0 : 0.0;
  const diff = k * (winVal - probability(currentRating, opponentRating));

  return diff;
}

/**
 * Create balanced teams based on the players rating.
 * @param players is an array of objects with name and their rating
 */
export function createBalancedTeams(players) {
  players.sort((a, b) => b.rating - a.rating);

  const teamSize = players.length / 2;
  const teams = players.reduce(
    (acc, curPlayer, idx) => {
      // console.log(`acc at idx=${idx}: `, acc);
      // If any team is full add the rest of the player to the other team
      if (acc[0].players.length >= teamSize) {
        acc[1] = addPlayerToTeam(curPlayer, acc[1]);
      } else if (acc[1].players.length >= teamSize) {
        acc[0] = addPlayerToTeam(curPlayer, acc[0]);

        // Add to the team with the lowest team rating
      } else if (acc[0].rating <= acc[1].rating) {
        acc[0] = addPlayerToTeam(curPlayer, acc[0]);
      } else {
        acc[1] = addPlayerToTeam(curPlayer, acc[1]);
      }

      return acc;
    },
    [
      { players: [], rating: 0 },
      { players: [], rating: 0 },
    ]
  );

  return teams;
}

/**
 * Pure function which adds a player to a team and updates the average rating of
 * it.
 */
function addPlayerToTeam(player, team) {
  const newTeamPlayers = [].concat(team.players, player.name);
  // Calculate incremental average
  const teamRating =
    (team.rating * team.players.length + player.rating) /
    (team.players.length + 1);

  return { players: newTeamPlayers, rating: teamRating };
}

/*
 * Pure functions for calculating updating ELO rating and using it to
 * balance teams.
 *
 * Rewrite off @ninyya's python implementation
 */

interface player {
  name: string;
  rating: number;
}

interface team {
  players: string[]; // TODO: Make array of interface player
  rating: number;
}

/**
 * Probablility for rating1 winning over rating2
 */
function probability(rating1: number, rating2: number): number {
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
export function ratingDiff(
  currentRating: number,
  opponentRating: number,
  win: boolean,
  numberOfGames: number
): number {
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
export function createBalancedTeams(
  players: player[]
): { players: string[]; rating: number }[] {
  players.sort((a, b) => b.rating - a.rating);

  const emptyTeam: team = {
    players: [],
    rating: 0,
  };

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
    [emptyTeam, emptyTeam]
  );

  return teams;
}

/**
 * n: number of elements to choose from
 * r: how many elements to choose
 */
export function allCombinations(n: number, r: number): number[][] {
  // initial array
  let arr = [];
  for (let i = 0; i < r; i++) {
    arr.push(i);
  }

  let res = [];

  // Got the algorithm from here
  // https://dev.to/rrampage/algorithms-generating-combinations-100daysofcode-4o0a
  let i = r - 1;
  while (arr[0] < n - r + 1) {
    // If outer elements are saturated, keep decrementing i till you find unsaturated element
    while (i > 0 && arr[i] == n - r + i) {
      i--;
    }
    res.push(arr.slice());
    arr[i]++;
    // Reset each outer element to prev element + 1
    while (i < r - 1) {
      arr[i + 1] = arr[i] + 1;
      i++;
    }
  }

  return res;
}

/**
 * Pure function which adds a player to a team and updates the average rating of
 * it.
 *
 * @param player to add to the team
 * @param team which the player is added to
 */
function addPlayerToTeam(player: player, team: team): team {
  const newTeamPlayers = [...team.players, player.name];
  // Calculate incremental average
  const teamRating =
    (team.rating * team.players.length + player.rating) /
    (team.players.length + 1);

  return { players: newTeamPlayers, rating: teamRating };
}

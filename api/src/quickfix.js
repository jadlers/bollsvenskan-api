/**
 * The goal is for this file to be empty at all times.
 */

import * as db from "./db.js";
import { ratingDiff } from "./elo.ts";

/**
 * WARNING: this resets the rating for all players
 * Utility function which should not need to be run more than once.
 *
 * Recalculates the ELO rating for each user and updates all matches they've
 * played with their ELO at the time of playing the match.
 */
export async function recalculateEloRatingForAllPlayers() {
  try {
    const matches = await db.getAllMatchesFromLeague(2); // NOTE: Hardcoded league
    // Make sure the matches are sorted in order since we're rewriting the ELO
    // advancments of each player from the beginning
    matches.forEach((match) => {
      match.dota_match_id = parseInt(match.dota_match_id);
    });
    matches.sort((a, b) => a.dota_match_id - b.dota_match_id);

    // Get data needed for each player: userId, eloRating, matchesPlayed
    const users = await db.getAllUsers();
    const playerData = users.map((user) => {
      return {
        id: user.id,
        username: user.username,
        eloRating: 1500,
        matchesPlayed: 0,
      };
    });

    // Loop over matches.
    for (const match of matches) {
      // Needed for each match: playerIds, winningTeamPlayerIds, averageTeamRatings
      const teamIds = await db.getTeamsInMatch(match.id);
      const teams = await Promise.all(
        teamIds.map(async (teamId) => {
          return { id: teamId, playerIds: await db.getUsersInTeam(teamId) };
        })
      );

      const playersIdsInMatch = teams.map((team) => team.playerIds).flat();

      // Calculate both teams average ELO (ELO for each player in the team)
      teams.forEach((team) => {
        const totalRating = team.playerIds.reduce((acc, playerId) => {
          const currentPlayerData = playerData.find(
            (player) => player.id === playerId
          );
          return acc + currentPlayerData.eloRating;
        }, 0);
        team.averageEloRating = totalRating / team.playerIds.length;
      });

      // DB: Update the ELO for each player in the match
      await Promise.all(
        teams.map(async (team) => {
          // Find out which players are in the winning team
          const winner = team.id === match.winning_team_id;
          // Calculate diff for each player
          team.playerIds.forEach(async (playerId) => {
            if (playerId === 25) {
              return;
            }
            const currentPlayerInfo = playerData.find(
              (player) => player.id === playerId
            );
            const eloRatingDiff = ratingDiff(
              team.averageEloRating,
              teams.filter((t) => t.id !== team.id)[0].averageEloRating,
              winner,
              currentPlayerInfo.matchesPlayed
            );
            currentPlayerInfo.eloRating += Math.round(eloRatingDiff);
            currentPlayerInfo.matchesPlayed++;
            await db.setUserEloRating(playerId, currentPlayerInfo.eloRating);
          });
        })
      );

      // DB: Add players current ELO to match in user_match_stats
      await Promise.all(
        playersIdsInMatch.map((playerId) => {
          const currentElo = playerData.find((player) => player.id === playerId)
            .eloRating;
          return db.setUserEloRatingForMatch(match.id, playerId, currentElo);
        })
      );
    }

    return playerData;
  } catch (err) {
    console.log(err);
  }
}

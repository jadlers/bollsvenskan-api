import { getUser } from "./db.js";
import { removeNullEntries } from "./util";

export type Player = {
  id: number;
  username: string;
  fullName?: string;
  steam32id?: string;
  discordId?: string;
  discordUsername?: string;
};

export function getPlayer(playerId: number): Promise<Player> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        id,
        username,
        full_name: fullName,
        elo_rating: eloRating,
        steam32id,
        discord_id: discordId,
        discord_username: discordUsername,
      } = await getUser(playerId);
      // const playerData = await getUser(playerId);

      let player: Player = {
        id: id as number,
        username: username as string,
        fullName: fullName as string,
        steam32id: steam32id as string,
        discordId: discordId as string,
        discordUsername: discordUsername as string,
      };

      player = removeNullEntries(player) as Player;
      resolve(player);
    } catch (err) {
      reject(err);
    }
  });
}

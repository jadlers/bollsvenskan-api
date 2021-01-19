export interface UserEntity {
  id: number;
  username: string;
  password?: string;
  apiKey?: string;
  fullName?: string;
  eloRating?: number;
  steam32id?: string;
  discordId?: string;
  discordUsername?: string;
}

export interface MatchEntity {
  id: number;
  isDeleted: boolean;
  date?: string;
  score?: string;
  winningTeamId: number;
  leagueId?: number;
  season?: number;
  dotaMatchId?: string; // NOTE: Or int? (VARCHAR)
  diedFirstBlood?: number;
  claimedFirstBlood?: number;
  firstBloodMock?: number;
  firstBloodPraise?: number;
}

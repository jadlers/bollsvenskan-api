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

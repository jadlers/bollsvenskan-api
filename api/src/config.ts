import * as dotenv from "dotenv";
dotenv.config();

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_HOST,
  POSTGRES_DB,
  DATABASE_URL,

  NEXTCLOUD_URL,
  NEXTCLOUD_PASSWORD,
  NEXTCLOUD_USERNAME,
} = process.env;

export const SERVER_PORT = Number(process.env.API_SERVER_PORT) || 5000;

export const DATABASE_CONNECTION_URL =
  DATABASE_URL ||
  `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}`;

export const NEXTCLOUD_INFO = {
  url: NEXTCLOUD_URL,
  password: NEXTCLOUD_PASSWORD,
  username: NEXTCLOUD_USERNAME,
};

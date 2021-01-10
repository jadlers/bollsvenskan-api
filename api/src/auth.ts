import { Request, Response, NextFunction } from "express";
import * as db from "./db";

/**
 * Checks that a valid API key is sent with the request.
 */
export async function isAuthorized(
  req: Request & { authorizedUser: any },
  res: Response,
  next: NextFunction
) {
  const apiKey = req.query.api_key as string;
  if (!apiKey) {
    res.status(401);
    return next("No API key provided");
  }

  try {
    const user = await db.getUserByApiKey(apiKey);
    req.authorizedUser = user;
  } catch (_) {
    const error = `The API key '${apiKey}' is not valid.`;
    res.status(401);
    next(error);
  }

  // If no errors, proceed!
  next();
}
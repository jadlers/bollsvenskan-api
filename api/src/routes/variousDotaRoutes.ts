import { Router } from "express";
import Joi from "@hapi/joi";

import { addNewFirstBloodPhrase, getAllFirstBloodPhrases } from "../db.js";
import { recalculateEloRatingForAllPlayers } from "../quickfix.js";

const router = Router();

// NOTE: This should be locked and only available for admins, useful at times
router.get("/recalculate-elo-for-all-players", async (req, res, next) => {
  try {
    const updatedData = await recalculateEloRatingForAllPlayers();
    updatedData.sort((a, b) => a.id - b.id);
    res.status(200).json({ message: "Success!", data: updatedData });
    next();
  } catch (error) {
    console.log(error);
    res.status(500).send("Nope");
    next();
  }
});

/** First blood mock phrases */
interface newPhraseRequestType {
  preName: string;
  postName: string;
  phraseType: "mock" | "praise";
}

/**
 * Get all firstblood phrases in the database
 */
router.get("/fb-phrase", async (_, res) => {
  try {
    const phrases = await getAllFirstBloodPhrases();
    res.status(200).json({ ok: true, data: phrases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

router.post("/fb-phrase", async (req, res) => {
  // NOTE: The schema should always match the newPhraseRequestType
  const schema = Joi.object().keys({
    preName: Joi.string().allow("").required(),
    postName: Joi.string().allow("").required(),
    phraseType: Joi.valid("mock", "praise").required(),
  });

  const { value, error } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    const errorInformation = error.details.map(
      (d) => d.message.replace(/\"/g, `'`) + " "
    );

    // Bad request, abort and give information about what has to change
    return res.status(400).json({
      ok: false,
      error: `${error.name}: ${errorInformation}`,
    });
  }

  // Data contains required fields
  const data: newPhraseRequestType = value;
  // Make sure at least one of pre/post-name is non-empty
  if (data.preName.trim() === "" && data.postName.trim() === "") {
    return res.status(400).json({
      ok: false,
      error: "Both 'preName' and 'postName' cannot be empty",
    });
  }

  const phrase = `${data.preName}<name>${data.postName}`;

  try {
    const id = await addNewFirstBloodPhrase(phrase, data.phraseType);
    return res.status(201).json({
      ok: true,
      message: `New ${data.phraseType} phrase added with id=${id}`,
    });
  } catch (err) {
    console.error("Error adding new FB phrase", err);
    return res
      .status(500)
      .json({ ok: false, message: "Unexpected internal error, my bad!" });
  }
});

export default router;

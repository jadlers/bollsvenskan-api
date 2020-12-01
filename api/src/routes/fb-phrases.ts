import Joi from "@hapi/joi";
import express from "express";
import { addNewFirstBloodPhrase, getAllFirstBloodPhrases } from "../db.js";

const router = express.Router();

interface newPhraseRequestType {
  preName: string;
  postName: string;
  phraseType: "mock" | "praise";
}

/**
 * Get all firstblood phrases in the database
 */
router.get("/", async (_, res) => {
  try {
    const phrases = await getAllFirstBloodPhrases();
    res.status(200).json({ ok: true, data: phrases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
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

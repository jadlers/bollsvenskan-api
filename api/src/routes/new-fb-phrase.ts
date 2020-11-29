import Joi from "@hapi/joi";
import express from "express";
import { addNewFirstBloodPhrase } from "../db.js";

const router = express.Router();

interface newPhraseRequestType {
  preName: string;
  postName: string;
  phraseType: "mock" | "praise";
}

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

  // Data contains required fields
  const data: newPhraseRequestType = value;

  if (!error) {
    if (data.preName.trim() === "" && data.postName.trim() === "") {
      return res.status(400).json({
        ok: false,
        error: "Both 'preName' and 'postName' cannot me empty",
      });
    }
  }

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

import Joi from "@hapi/joi";
import express from "express";

const router = express.Router();

interface newPhraseRequestType {
  preName: string;
  postName: string;
  phraseType: "mock" | "praise";
}

router.post("/", (req, res) => {
  // NOTE: The schema should always match the newPhraseRequestType
  const schema = Joi.object().keys({
    preName: Joi.string().required(),
    postName: Joi.string().required(),
    phraseType: Joi.allow("mock", "praise"),
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
      error: `${error.name}: ${errorInformation}`,
    });
  }

  // Data contains required fields
  const data: newPhraseRequestType = value;

  res.status(501).json(data);
});

export default router;

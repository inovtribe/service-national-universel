const express = require("express");
const passport = require("passport");
const fetch = require("node-fetch");
const queryString = require("querystring");
const crypto = require("crypto");
const router = express.Router();

const config = require("../config");
const { capture } = require("../sentry");

const { uploadFile } = require("../utils");
const { encrypt } = require("../cryptoUtils");
const { watermarkPdf, watermarkImage } = require("../imageUtils");

const YoungObject = require("../models/young");
const AuthObject = require("../auth");

const YoungAuth = new AuthObject(YoungObject);

const SERVER_ERROR = "SERVER_ERROR";
const FILE_CORRUPTED = "FILE_CORRUPTED";
const YOUNG_ALREADY_REGISTERED = "YOUNG_ALREADY_REGISTERED";

router.post("/signin", (req, res) => YoungAuth.signin(req, res));
router.post("/logout", (req, res) => YoungAuth.logout(req, res));
router.post("/signup", (req, res) => YoungAuth.signup(req, res));

router.get("/signin_token", passport.authenticate("young", { session: false }), (req, res) => YoungAuth.signinToken(req, res));
router.post("/forgot_password", async (req, res) => YoungAuth.forgotPassword(req, res, `${config.APP_URL}/auth/reset`));
router.post("/forgot_password_reset", async (req, res) => YoungAuth.forgotPasswordReset(req, res));
router.post("/reset_password", passport.authenticate("young", { session: false }), async (req, res) => YoungAuth.resetPassword(req, res));

router.post("/file/:key", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const key = req.params.key;
    const names = JSON.parse(req.body.body).names;
    const files = Object.keys(req.files || {}).map((e) => req.files[e]);

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      const { name, data, mimetype } = currentFile;
      let bufferWithWaterMark = null;

      if (mimetype.includes("image/")) {
        bufferWithWaterMark = await watermarkImage(data);
      } else if (mimetype === "application/pdf") {
        bufferWithWaterMark = await watermarkPdf(data, 0);
      }
      const encryptedBuffer = encrypt(bufferWithWaterMark);
      const resultingFile = { mimetype: "image/png", encoding: "7bit", data: encryptedBuffer };
      await uploadFile(`app/young/${req.user._id}/${key}/${name}`, resultingFile);
    }
    req.user.set({ [key]: names });
    await req.user.save();
    return res.status(200).send({ data: names, ok: true });
  } catch (error) {
    capture(error);
    if (error === "FILE_CORRUPTED") return res.status(500).send({ ok: false, code: FILE_CORRUPTED });
    return res.status(500).send({ ok: false, code: SERVER_ERROR });
  }
});

router.post("/", async (req, res) => {
  try {
    const young = await YoungObject.create(req.body);
    return res.status(200).send({ young, ok: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).send({ ok: false, code: YOUNG_ALREADY_REGISTERED });
    capture(error);
    return res.status(500).send({ ok: false, code: SERVER_ERROR });
  }
});

router.get("/", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const young = await YoungObject.findOne({ user_id: req.user._id });
    return res.status(200).send({ ok: true, young });
  } catch (error) {
    capture(error);
    res.status(500).send({ ok: false, code: SERVER_ERROR, error });
  }
});

//@check
router.put("/", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const young = await YoungObject.findByIdAndUpdate(req.user._id, req.body, { new: true });
    res.status(200).send({ ok: true, data: young });
  } catch (error) {
    capture(error);
    res.status(500).send({ ok: false, code: SERVER_ERROR, error });
  }
});

router.get("/france-connect/authorization-url", async (req, res) => {
  const query = {
    scope: `openid given_name family_name email`,
    redirect_uri: process.env.FRANCE_CONNECT_REDIRECT_URI,
    response_type: "code",
    client_id: process.env.FRANCE_CONNECT_CLIENT_ID,
    state: "home",
    nonce: crypto.randomBytes(20).toString("hex"),
    acr_values: "eidas1",
  };
  const url = `${process.env.FRANCE_CONNECT_URL}/authorize?${queryString.stringify(query)}`;
  res.status(200).send({ ok: true, data: { url } });
});

router.post("/france-connect/user-info", async (req, res) => {
  console.log(req.body.code);
  const body = {
    grant_type: "authorization_code",
    redirect_uri: process.env.FRANCE_CONNECT_REDIRECT_URI,
    client_id: process.env.FRANCE_CONNECT_CLIENT_ID,
    client_secret: process.env.FRANCE_CONNECT_CLIENT_SECRET,
    code: req.body.code,
  };
  const obj = {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: queryString.stringify(body),
  };
  const res1 = await fetch(`${process.env.FRANCE_CONNECT_URL}/token`, obj);
  const r1 = await res1.json();

  console.log(r1);

  if (!r1["access_token"] || !r1["id_token"]) {
    return res.sendStatus(401, r1);
  }

  console.log({ headers: { Authorization: `Bearer ${r1["access_token"]}` } });

  const res2 = await fetch(`https://fcp.integ01.dev-franceconnect.fr/api/v1/userinfo`, {
    method: "GET",
    headers: { Authorization: `Bearer ${r1["access_token"]}` },
  });
  console.log("SEE BELOW");
  console.log(res2);
  const r2 = await res2.json();
  console.log(r2);

  res.status(200).send({ ok: true, data: r2 });
  return r1;
});

module.exports = router;

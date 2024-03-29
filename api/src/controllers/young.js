const express = require("express");
const passport = require("passport");
const fetch = require("node-fetch");
const queryString = require("querystring");
const crypto = require("crypto");
const router = express.Router();
const jwt = require("jsonwebtoken");

const config = require("../config");
const { capture } = require("../sentry");

const { encrypt } = require("../cryptoUtils");
const { getQPV } = require("../qpv");
const YoungObject = require("../models/young");
const AuthObject = require("../auth");
const { uploadFile, validatePassword, ERRORS } = require("../utils");

const YoungAuth = new AuthObject(YoungObject);

const COOKIE_MAX_AGE = 60 * 60 * 2 * 1000; // 2h

router.post("/signin", (req, res) => YoungAuth.signin(req, res));
router.post("/logout", (req, res) => YoungAuth.logout(req, res));
router.post("/signup", (req, res) => YoungAuth.signup(req, res));

router.get("/signin_token", passport.authenticate("young", { session: false }), (req, res) => YoungAuth.signinToken(req, res));
router.post("/forgot_password", async (req, res) => YoungAuth.forgotPassword(req, res, `${config.APP_URL}/auth/reset`));
router.post("/forgot_password_reset", async (req, res) => YoungAuth.forgotPasswordReset(req, res));
router.post("/reset_password", passport.authenticate("young", { session: false }), async (req, res) => YoungAuth.resetPassword(req, res));

function cookieOptions() {
  if (config.ENVIRONMENT === "development") {
    return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: false };
  } else {
    return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: true, sameSite: "none" };
  }
}

router.post("/file/:key", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const key = req.params.key;
    const names = JSON.parse(req.body.body).names;
    const files = Object.keys(req.files || {}).map((e) => req.files[e]);

    for (let i = 0; i < files.length; i++) {
      let currentFile = files[i];
      // If multiple file with same names are provided, currentFile is an array. We just take the latest.
      if (Array.isArray(currentFile)) {
        currentFile = currentFile[currentFile.length - 1];
      }
      const { name, data, mimetype } = currentFile;
      if (!["image/jpeg", "image/png", "application/pdf"].includes(mimetype)) return res.status(500).send({ ok: false, code: "UNSUPPORTED_TYPE" });

      const encryptedBuffer = encrypt(data);
      const resultingFile = { mimetype: "image/png", encoding: "7bit", data: encryptedBuffer };
      await uploadFile(`app/young/${req.user._id}/${key}/${name}`, resultingFile);
    }
    req.user.set({ [key]: names });
    await req.user.save();
    return res.status(200).send({ data: names, ok: true });
  } catch (error) {
    capture(error);
    if (error === "FILE_CORRUPTED") return res.status(500).send({ ok: false, code: ERRORS.FILE_CORRUPTED });
    return res.status(500).send({ ok: false, code: ERRORS.SERVER_ERROR });
  }
});

router.post("/signup_verify", async (req, res) => {
  try {
    const young = await YoungObject.findOne({ invitationToken: req.body.invitationToken, invitationExpires: { $gt: Date.now() } });
    if (!young) return res.status(200).send({ ok: false, code: ERRORS.INVITATION_TOKEN_EXPIRED_OR_INVALID });
    const token = jwt.sign({ _id: young._id }, config.secret, { expiresIn: "30d" });
    return res.status(200).send({ ok: true, token, data: young });
  } catch (error) {
    capture(error);
    return res.status(500).send({ ok: false, code: ERRORS.SERVER_ERROR });
  }
});

router.post("/signup_invite", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    const young = await YoungObject.findOne({ email });
    if (!young) return res.status(200).send({ ok: false, data: null, code: ERRORS.USER_NOT_FOUND });

    if (young.registredAt) return res.status(200).send({ ok: false, data: null, code: ERRORS.YOUNG_ALREADY_REGISTERED });

    if (!validatePassword(req.body.password)) return res.status(200).send({ ok: false, prescriber: null, code: ERRORS.PASSWORD_NOT_VALIDATED });

    young.set({ password: req.body.password });
    young.set({ registredAt: Date.now() });
    young.set({ lastLoginAt: Date.now() });
    young.set({ invitationToken: "" });
    young.set({ invitationExpires: null });

    const token = jwt.sign({ _id: young.id }, config.secret, { expiresIn: "30d" });
    res.cookie("jwt", token, cookieOptions());

    await young.save();

    young.password = undefined;

    return res.status(200).send({ data: young, token, ok: true });
  } catch (error) {
    capture(error);
    return res.sendStatus(500).send({ ok: false, code: ERRORS.SERVER_ERROR });
  }
});

router.post("/", async (req, res) => {
  try {
    const young = await YoungObject.create(req.body);
    return res.status(200).send({ young, ok: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).send({ ok: false, code: ERRORS.YOUNG_ALREADY_REGISTERED });
    capture(error);
    return res.status(500).send({ ok: false, code: ERRORS.SERVER_ERROR });
  }
});

router.get("/", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const young = await YoungObject.findOne({ user_id: req.user._id });
    return res.status(200).send({ ok: true, young });
  } catch (error) {
    capture(error);
    res.status(500).send({ ok: false, code: ERRORS.SERVER_ERROR, error });
  }
});

//@check
router.put("/", passport.authenticate("young", { session: false }), async (req, res) => {
  try {
    const obj = req.body;

    const young = await YoungObject.findByIdAndUpdate(req.user._id, obj, { new: true });
    res.status(200).send({ ok: true, data: young });

    //Check quartier prioritaires.
    if (obj.zip && obj.city && obj.address) {
      const qpv = await getQPV(obj.zip, obj.city, obj.address);
      if (qpv === true) {
        young.set({ qpv: "true" });
      } else if (qpv === false) {
        young.set({ qpv: "false" });
      } else {
        young.set({ qpv: "" });
      }
      await young.save();
    }
  } catch (error) {
    capture(error);
    res.status(500).send({ ok: false, code: ERRORS.SERVER_ERROR, error });
  }
});

// Get authorization from France Connect.
router.post("/france-connect/authorization-url", async (req, res) => {
  const query = {
    scope: `openid given_name family_name email`,
    redirect_uri: `${config.APP_URL}/${req.body.callback}`,
    response_type: "code",
    client_id: process.env.FRANCE_CONNECT_CLIENT_ID,
    state: "home",
    nonce: crypto.randomBytes(20).toString("hex"),
    acr_values: "eidas1",
  };
  const url = `${process.env.FRANCE_CONNECT_URL}/authorize?${queryString.stringify(query)}`;
  res.status(200).send({ ok: true, data: { url } });
});

// Get user information for authorized user on France Connect.
router.post("/france-connect/user-info", async (req, res) => {
  // Get token…
  const body = {
    grant_type: "authorization_code",
    redirect_uri: `${config.APP_URL}/${req.body.callback}`,
    client_id: process.env.FRANCE_CONNECT_CLIENT_ID,
    client_secret: process.env.FRANCE_CONNECT_CLIENT_SECRET,
    code: req.body.code,
  };
  const tokenResponse = await fetch(`${process.env.FRANCE_CONNECT_URL}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: queryString.stringify(body),
  });
  const token = await tokenResponse.json();

  if (!token["access_token"] || !token["id_token"]) {
    return res.sendStatus(401, token);
  }

  // … then get user info.
  const userInfoResponse = await fetch(`${process.env.FRANCE_CONNECT_URL}/userinfo`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token["access_token"]}` },
  });
  const userInfo = await userInfoResponse.json();
  res.status(200).send({ ok: true, data: userInfo, tokenId: token["id_token"] });
});

// Delete one user (only admin can delete user)
router.delete("/:id", passport.authenticate("referent", { session: false }), async (req, res) => {
  try {
    const young = await YoungObject.findOne({ _id: req.params.id });
    await young.remove();
    console.log(`Young ${req.params.id} has been deleted`);
    res.status(200).send({ ok: true });
  } catch (error) {
    capture(error);
    res.status(500).send({ ok: false, error, code: ERRORS.SERVER_ERROR });
  }
});

module.exports = router;

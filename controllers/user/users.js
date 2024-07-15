import dotenv from "dotenv";
dotenv.config();

import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { db } from "../../models/index.js";
import { sendOtpToEmail } from "../../utils/utils.js";
import asyncErrorHandler from "../../Error/asyncErrorHandler.js";
import ErrorHandler from "../../Error/errorHandler.js";

export const healthzController = (req, res) => {
  res.status(200).json({
    message: "Health check successfully",
  });
};

export const userSignUp = async (req, res, next) => {
  const { name, email, phoneNo, password, city, state } = req.body;
  try {
    // validate Email
    if (!validator.isEmail(email)) throw Error("Invalid Email");

    // check if user exists
    const countExistingUser = await db.User.findAndCountAll({
      where: {
        email,
      },
    });

    if (countExistingUser.count != 0) throw Error("User already exists");

    // validate Phone Number
    if (!validator.isMobilePhone(phoneNo, ["en-IN"]))
      throw Error("Invalid Phone Number");

    // validate password - password length minimum 6 charachters
    if (password.length < 6) throw Error("Password too short");

    // validate password - password length maximum 20 charachters
    if (password.length > 20) throw Error("Password too long");

    // generating password hash
    const salt = bcrypt.genSaltSync(12);
    const hash = await bcrypt.hash(password, salt);

    // send otp to email
    const otp = await sendOtpToEmail(req, res, next);
    let hashedOtp = bcrypt.hashSync(otp, 8);

    const userDetails = {
      name,
      email,
      phoneNo,
      city,
      state,
      password: hash,
      otp: hashedOtp,
    };

    const otpToken = jwt.sign(userDetails, process.env.SECRET, {
      expiresIn: "10m",
    });

    res.status(200).send({
      message: "OTP sent to email",
      otp_token: otpToken,
      otp,
    });
  } catch (error) {
    console.log("error is here -->", error);
    res.status(400).json({ error: error.message });
  }
};

export const verifyAndRegister = async (req, res) => {
  try {
    const { otpToken, email, otp } = req.body;

    const userDetails = jwt.verify(
      otpToken,
      process.env.SECRET,
      (err, data) => {
        if (err) throw Error("OTP is expired...!");
        return data;
      }
    );

    if (!userDetails) throw Error("OTP expired");

    if (userDetails.email != email) throw Error("Invalid Email");

    var otpIsValid = bcrypt.compareSync(otp, userDetails.otp);
    if (!otpIsValid) throw Error("Invalid OTP");

    const newUser = await db.User.create({
      name: userDetails.name,
      email: userDetails.email,
      phoneNo: userDetails.phoneNo,
      city: userDetails.city,
      state: userDetails.state,
      password: userDetails.password,
    });

    await db.Cart.create({
      userId: newUser.userId,
    });

    // creating access and refresh tokens
    let accessTokenTime = 1000 * 60 * 60 * 24;
    let refreshTokenTime = 1000 * 60 * 60 * 24 * 7;
    const accessToken = jwt.sign(
      { userId: newUser.userId },
      process.env.USER_ACCESS_TOKEN_SECRET,
      { expiresIn: String(accessTokenTime) }
    );
    const refreshToken = jwt.sign(
      { userId: newUser.userId },
      process.env.USER_REFRESH_TOKEN_SECRET,
      { expiresIn: String(refreshTokenTime) }
    );

    res.status(200).json({
      userId: newUser.userId,
      name: newUser.name,
      email: newUser.email,
      phoneNo: newUser.phoneNo,
      city: newUser.city,
      state: newUser.state,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const userSignIn = async (req, res) => {
  const { email, password } = req.body;
  try {
    // validate Email
    if (!validator.isEmail(email)) throw Error("Invalid Email");

    // check if user exists
    const existingUser = await db.User.findOne({
      where: {
        email,
      },
    });

    if (!existingUser) throw Error("User does not exist");

    // compare passwords
    const match = await bcrypt.compare(password, existingUser.password);

    if (!match) throw Error("Incorrect Password");

    // create access and refresh tokens
    let accessTokenTime = 1000 * 60 * 60 * 24;
    let refreshTokenTime = 1000 * 60 * 60 * 24 * 7;
    const accessToken = jwt.sign(
      { userId: existingUser.userId },
      process.env.USER_ACCESS_TOKEN_SECRET,
      { expiresIn: String(accessTokenTime) }
    );
    const refreshToken = jwt.sign(
      { userId: existingUser.userId },
      process.env.USER_REFRESH_TOKEN_SECRET,
      { expiresIn: String(refreshTokenTime) }
    );

    res.status(200).json({
      userId: existingUser.userId,
      name: existingUser.name,
      email: existingUser.email,
      phoneNo: existingUser.phoneNo,
      city: existingUser.city,
      state: existingUser.state,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const userRefreshToken = async (req, res) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    const refreshToken = authorization.split(" ")[1];

    // check refresh token recieved
    if (!refreshToken) throw Error("Refresh token not found");

    // extract data from jwt
    const data = jwt.verify(
      refreshToken,
      process.env.USER_REFRESH_TOKEN_SECRET
    );
    if (!data.userId) throw Error("Invalid refresh token");

    const blacklistedRefreshToken = await db.Blacklist.findOne({
      where: { refreshToken: refreshToken },
    });

    if (blacklistedRefreshToken) throw Error("Refresh Token is expired");

    // create access and refresh tokens
    let accessTokenTime = 1000 * 60 * 60 * 24;
    let refreshTokenTime = 1000 * 60 * 60 * 24 * 7;
    const accessToken = jwt.sign(
      { userId: data.userId },
      process.env.USER_ACCESS_TOKEN_SECRET,
      { expiresIn: String(accessTokenTime) }
    );
    const newRefreshToken = jwt.sign(
      { userId: data.userId },
      process.env.USER_REFRESH_TOKEN_SECRET,
      { expiresIn: String(refreshTokenTime) }
    );

    const newblacklistedRefreshToken = await db.Blacklist.create({
      refreshToken: refreshToken,
    });

    if (!newblacklistedRefreshToken) throw Error("Something went wrong...!");

    res.status(200).json({
      accessToken: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  const otp = await sendOtpToEmail(req, res, next);
  let hashedOtp = bcrypt.hashSync(otp, 8);

  const userDetails = {
    email,
    otp: hashedOtp,
  };

  const otpToken = jwt.sign(userDetails, process.env.SECRET, {
    expiresIn: "10m",
  });

  res.status(200).json({
    message: "otp sent successfully",
    otp_token: otpToken,
  });
};

export const verifyAndChangePassword = async (req, res, next) => {
  try {
    const { email, otp_token, otp } = req.body;

    const userDetails = jwt.verify(
      otp_token,
      process.env.SECRET,
      (err, decoded) => {
        if (err) throw Error("OTP is expired...!");
        return decoded;
      }
    );

    if (!userDetails) return next(new ErrorHandler("otp expired", 400));

    if (userDetails.email != email)
      return next(new ErrorHandler("Invalid email", 400));

    var otpIsValid = bcrypt.compareSync(otp, userDetails.otp);
    if (!otpIsValid) return next(new ErrorHandler("Invalid Otp", 400));

    const isChanged = await changePassword(req, res, next);

    if (!isChanged)
      return next(new ErrorHandler("failed to changed the password", 400));

    res.status(200).json({
      message: "verified successfully and password changed successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "internal server error",
    });
  }
};

export const changePassword = asyncErrorHandler(async (req, res, next) => {
  const { email, newPassword } = req.body;
  const salt = bcrypt.genSaltSync(12);

  const newHash = await bcrypt.hash(newPassword, salt);

  const updatedUser = await db.User.update(
    { password: newHash },
    { where: { email: email } }
  );
  if (updatedUser[0] !== 1) return false;
  return true;
});

export const updateUserDetails = async (req, res) => {
  try {
    const { name, email, phoneNo, city, state, password } = req.body;
    const { id } = req.params;
    await db.User.update(
      {
        name,
        email,
        phoneNo,
        city,
        state,
        password,
      },
      {
        where: {
          userId: id,
        },
      }
    );
    res.status(200).json({
      status: true,
      message: "Successfull",
    });
  } catch (error) {
    res.status(400).json({ status: false, error: error.message });
  }
};

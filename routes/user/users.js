import express from "express";

import {
  userSignIn,
  userSignUp,
  userRefreshToken,
  forgotPassword,
  verifyAndRegister,
  verifyAndChangePassword,
  healthzController,
  updateUserDetails,
} from "../../controllers/user/users.js";
import requireUserAuth from "../../middlewares/requireUserAuth.js";
import { sendOtp } from "../../controllers/verification/emailVerification.js";
import {
  addToCart,
  getCartByUser,
  removeFromCart,
  updateCart,
} from "../../controllers/cartOrders/carts.js";
import {
  checkPayment,
  checkPayment2,
  createOrder,
  getAllOrdersOfUser,
  initiatePayment,
  paymentFailed,
} from "../../controllers/cartOrders/orders.js";

const router = express.Router();

//health check API
router.get("/healthz", healthzController);

// authentication
router.post("/user/signup", userSignUp);
router.post("/user/signup/verify", verifyAndRegister);
router.post("/user/signin", userSignIn);
router.post("/user/refresh", userRefreshToken);
router.post("/user/forgot-password", forgotPassword);
router.post("/user/forgot-password/verify", verifyAndChangePassword);
router.post("/user/send-otp", sendOtp);

// cart routes
router.post("/user/update/:id", requireUserAuth, updateUserDetails);
router.get("/user/cart", requireUserAuth, getCartByUser);
router.post("/user/cart", requireUserAuth, updateCart);
router.post("/user/cart/add", requireUserAuth, addToCart);
router.post("/user/cart/remove", requireUserAuth, removeFromCart);
// router.post('/user/:userId/cart',  updateCart)

// payment routes
router.post("/user/payment", requireUserAuth, initiatePayment);
router.post("/user/payment/check", requireUserAuth, checkPayment);
router.post("/user/payment/webhook", checkPayment2);
router.post("/user/payment/failed", requireUserAuth, paymentFailed);

// order routes
router.get("/user/order", requireUserAuth, getAllOrdersOfUser);
router.post("/user/order", requireUserAuth, createOrder);

export default router;

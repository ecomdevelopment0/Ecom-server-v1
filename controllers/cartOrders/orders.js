import crypto from "crypto";
import asyncErrorHandler from "../../Error/asyncErrorHandler.js";
import ErrorHandler from "../../Error/errorHandler.js";
import Order from "../../models/order/orders.js";
import {
  calculateGST,
  calculateOrderAmount,
  order,
  sendEmail,
  sendKeys,
  unlockKeys,
  unlockKeysIndividual,
} from "../../utils/utils.js";
import lockedKeys from "../../models/order/lockedKeys.js";
import { db } from "../../models/index.js";
import { CreateOrder } from "../../utils/createOrder.js";

export const initiatePayment = asyncErrorHandler(async (req, res, next) => {
  try {
    let { totalAmount, userCart } = await calculateOrderAmount(req, res, next);
    totalAmount = totalAmount + calculateGST(totalAmount);
    req.body.totalAmount = totalAmount;
    const userDetails = req.userDetails;

    const existingLockedKeys = await lockedKeys.findOne({
      where: { userId: userCart.userId },
    });
    if (existingLockedKeys) {
      req.body.userCart = userCart;
      await unlockKeys(req, res, next);

      await lockedKeys.destroy({
        where: {
          userId: req.body.userCart.userId,
        },
      });
    }

    req.body.userCart = userCart;
    const isAvailable = await getProductKeys(req, res, next);
    if (!isAvailable)
      return next(
        new ErrorHandler(
          "keys not available, order has been sent to pendingDeliveries",
          400
        )
      );

    setTimeout(async () => {
      const key = await lockedKeys.findOne({
        where: { userId: req.body.userCart.userId },
      });
      if (`${req.body.keys.createdAt}` != `${key.createdAt}`) return; //important

      await unlockKeys(req, res, next);
      await lockedKeys.destroy({
        where: {
          userId: req.body.userCart.userId,
        },
      });
    }, 1000 * 60 * 4); // This should be more than what is on the client side otherwise can lead to data inconsistency

    const keys = await lockedKeys.create({
      userId: req.body.userCart.userId,
      products: req.body.userCart.products,
      totalPrice: req.body.totalAmount,
    });
    req.body.keys = keys; // important
    const paymentResponse = await CreateOrder(
      totalAmount,
      userDetails,
      userCart.dataValues.products
    );
    const response = await order(req, res, next);
    return res.status(200).json({
      response,
      success: true,
      message: "Payment Captured Successfully",
      data: paymentResponse,
    });
  } catch (error) {
    console.log(error);
  }
});

export const checkPayment = asyncErrorHandler(async (req, res, next) => {
  const { order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify the payment signature
  const hmac = crypto.createHmac("sha256", process.env.razorpay_secret);
  hmac.update(order_id + "|" + razorpay_payment_id);
  const calculatedSignature = hmac.digest("hex");

  if (calculatedSignature === razorpay_signature) {
    // Payment successful
    res.status(200).send({
      success: true,
      status: 200, // important
    });
  } else {
    res.status(400).send({
      success: false,
      status: 400, // important
    });
  }
});

export const checkPayment2 = asyncErrorHandler(async (req, res, next) => {
  console.log("Webhook controller hit");
  const razorpay_signature = req.headers["x-razorpay-signature"];
  const razorpay_order_id = req.body.payload.payment.entity.order_id;
  const razorpay_payment_id = req.body.payload.payment.entity.id;
  const { userId, email, name, phoneNo, city, state } =
    req.body.payload.payment.entity.notes;
  const { amount, method, status } = req.body.payload.payment.entity;
  let tamount = amount / 100;

  const { products } = await lockedKeys.findOne({
    where: { userId },
  });

  // Verify the payment signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.razorpay_secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    console.log("signature not matched");
    return res.status(401).json({
      success: false,
      message: "Invalid Signature",
    });
  }
  console.log("signature matched");

  const { event } = req.body;

  if (event === "payment.captured") {
    console.log("payment captured");
    // payment is successfully debited from user acc and credited to merchant acc

    let text = `The payment of purchase of antivirus worth ${tamount} was successful.`;

    text += `\n Razorpay payment status : ${status}`;
    text += `\n Razorpay payment method : ${method}`;
    text += `\n Razorpay order id : ${razorpay_order_id}`;
    text += `\n Razorpay payment id : ${razorpay_payment_id}`;

    text += `\n Here's products purchase details `;
    text += `\n No. of products in cart at the time of payment : `;
    products.map((product) => {
      let i = 1;
      text += `\n    ${i++}. '${product.name}'  `;
    });

    text += `\n User details `;
    text += `\n User Id : ${userId}`;
    text += `\n User email : ${email}`;
    text += `\n User name : ${name}`;
    text += `\n User phone no. : ${phoneNo}`;
    text += `\n User city : ${city}`;
    text += `\n User state : ${state}`;

    console.log(text);
    sendEmail(req, res, next, text);
  }

  if (event === "payment.failed") {
    console.log("payment failed");
    // payment is failed
    let text = `The payment of purchase of antivirus worth ${tamount} was failed.`;

    text += `\n Razorpay payment status : ${status}`;
    text += `\n Razorpay payment method : ${method}`;
    text += `\n Razorpay order id : ${razorpay_order_id}`;
    text += `\n Razorpay payment id : ${razorpay_payment_id}`;

    text += `\n Here's products purchase details `;
    text += `\n No. of products in cart at the time of payment : `;
    products.map((product) => {
      let i = 1;
      text += `\n    ${i++}. '${product.name}'  `;
    });

    text += `\n User details `;
    text += `\n User Id : ${userId}`;
    text += `\n User email : ${email}`;
    text += `\n User name : ${name}`;
    text += `\n User phone no. : ${phoneNo}`;
    text += `\n User city : ${city}`;
    text += `\n User state : ${state}`;

    text += `\n Check once the money is debited or not :)`;

    console.log(text);
    sendEmail(req, res, next, text);
  }

  return res.status(201).json({
    success: true,
  });
});

export const createOrder = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const data = await lockedKeys.findOne({ where: { userId: userId } });
  if (!data)
    return next(new ErrorHandler("user not found with locked keys", 400));
  const { order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const { products, totalPrice } = data;

  const orderDetails = await db.Order.create({
    razorpay_orderId: order_id,
    userId: userId,
    products: products,
    totalPrice: totalPrice,
    razorpay_payment_id: razorpay_payment_id,
    razorpay_signature: razorpay_signature,
    paymentStatus: "success",
  });

  for (let product of products) {
    const { productKeys, productId } = product;
    for (let productKey of productKeys) {
      await db.ProductKey.update(
        {
          orderId: orderDetails.orderId,
        },
        {
          where: {
            productKey,
            productId, //important
          },
        }
      );
    }
  }

  for (const product of products) {
    const pr = await db.Product.findOne({
      where: { productId: product.productId },
    });
    pr.inStock = pr.inStock - product.quantity;
    await pr.save();
  }

  setTimeout(async () => {
    const userCart = await db.Cart.findOne({ where: { userId } });
    userCart.products = [];
    await userCart.save();
  }, 0);

  req.body.orderDetails = orderDetails;
  await sendKeys(req, res, next);

  return res.status(200).json({
    statusCode: 200,
    success: true,
  });
});

export const paymentFailed = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const data = await lockedKeys.findOne({ where: { userId: userId } });
  if (!data)
    return next(new ErrorHandler("user not found with locked keys", 400));
  const { order_id, razorpay_payment_id, razorpay_signature, reason } =
    req.body;
  const { products, totalPrice } = data;
  await Order.create({
    razorpay_orderId: order_id,
    userId: userId,
    products: products,
    totalPrice: totalPrice,
    razorpay_payment_id: razorpay_payment_id,
    razorpay_signature: razorpay_signature,
    paymentStatus: "failed",
    paymentFailedReason: reason,
  });
});

export const getProductKeys = async (req, res, next) => {
  let transaction;

  try {
    transaction = await db.sequelize.transaction();
    const products = req.body.userCart.products;

    for (let i = 0; i < products.length; i++) {
      req.body.userCart.products[i].productKeys = [];
      const product = products[i];

      const query = `
                UPDATE "productKeys" SET "isSold" = :newValue
                WHERE "productKeyId" IN (
                    SELECT "productKeyId"
                    FROM "productKeys"
                    WHERE "productId" = :productId AND "isSold" = :oldValue
                    LIMIT :quantity
                )
                RETURNING *;`;

      const [updatedRows, updatedRowCount] = await db.sequelize.query(query, {
        replacements: {
          newValue: true,
          productId: product.productId,
          oldValue: false,
          quantity: product.quantity,
        },
        type: db.sequelize.QueryTypes.UPDATE,
        transaction: transaction,
      });

      if (updatedRowCount !== product.quantity) {
        throw new Error("Required quantity is not available");
      }

      for (const updatedRow of updatedRows) {
        req.body.userCart.products[i].productKeys.push(updatedRow.productKey);
      }
    }
    await transaction.commit();
    return true;
  } catch (error) {
    console.log({ error });
    if (transaction) await transaction.rollback();
    next(new ErrorHandler("Keys not available, try after some time", 400));
    return false;
  }
};

export const getAllOrdersOfUser = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;

  const q = req.query;

  const page = q?.page ? +q.page : 1;
  const limit = q?.limit ? +q.limit : 10;
  const offset = (page - 1) * limit;

  const { count, rows } = await db.Order.findAndCountAll({
    where: {
      userId: userId,
    },
    offset,
    limit,
  });

  let totalPages = Math.ceil(count / limit);
  if (!totalPages) totalPages = 0;

  res.status(200).json({
    page,
    limit,
    count: count ? count : 0,
    totalPages,
    data: rows ? rows : [],
  });
});

export const initiatePaymentIndividual = async (req, res, next) => {
  try {
    let { totalAmount, productId, quantity } = req.body;
    let userId = req.query.userId;

    req.body.totalAmount = totalAmount;
    const userDetails = req.userDetails;

    const existingLockedKeys = await lockedKeys.findOne({
      where: { userId },
    });
    if (existingLockedKeys) {
      await unlockKeysIndividual(userId);

      await lockedKeys.destroy({
        where: {
          userId,
        },
      });
    }

    const isAvailable = await getProductKeysIndividual(productId, quantity);
    if (!isAvailable)
      return next(
        new ErrorHandler(
          "keys not available, order has been sent to pendingDeliveries",
          400
        )
      );

    setTimeout(async () => {
      const key = await lockedKeys.findOne({
        where: { userId },
      });
      if (`${req.body.keys.createdAt}` != `${key.createdAt}`) return; //important

      await unlockKeysIndividual(userId);
      await lockedKeys.destroy({
        where: {
          userId,
        },
      });
    }, 1000 * 60 * 4); // This should be more than what is on the client side otherwise can lead to data inconsistency

    const fetchedProduct = await db.Product.findOne({
      where: { productId: productId },
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: {
        model: db.ProductKey,
        where: {
          isSold: false,
        },
      },
    });

    let products = [{ ...fetchedProduct, quantity }];
    const keys = await lockedKeys.create({
      userId,
      products,
      totalPrice: totalAmount,
    });
    req.body.keys = keys; // important
    const paymentResponse = await CreateOrder(
      totalAmount,
      userDetails,
      products
    );
    const response = await order(req, res, next);
    return res.status(200).json({
      response,
      success: true,
      message: "Payment Captured Successfully",
      data: paymentResponse,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error,
      success: false,
      message: error.message,
    });
  }
};

export const getProductKeysIndividual = async (productId, quantity) => {
  let transaction;

  try {
    transaction = await db.sequelize.transaction();
    let productKeys = [];

    const query = `
                UPDATE "productKeys" SET "isSold" = :newValue
                WHERE "productKeyId" IN (
                    SELECT "productKeyId"
                    FROM "productKeys"
                    WHERE "productId" = :productId AND "isSold" = :oldValue
                    LIMIT :quantity
                )
                RETURNING *;`;

    const [updatedRows, updatedRowCount] = await db.sequelize.query(query, {
      replacements: {
        newValue: true,
        productId: productId,
        oldValue: false,
        quantity: quantity,
      },
      type: db.sequelize.QueryTypes.UPDATE,
      transaction: transaction,
    });

    if (updatedRowCount !== quantity) {
      throw new Error("Required quantity is not available");
    }

    for (const updatedRow of updatedRows) {
      productKeys.push(updatedRow.productKey);
    }
    await transaction.commit();
    return true;
  } catch (error) {
    console.log({ error });
    if (transaction) await transaction.rollback();
    next(new ErrorHandler("Keys not available, try after some time", 400));
    return false;
  }
};

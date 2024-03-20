import instance from "../razorpay.js";

export const CreateOrder = async (amount, user) => {
  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: Math.random(Date.now()).toString(),
    notes: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      phoneNo: user.phoneNo,
      city: user.city,
      state: user.state,
    },
  };
  try {
    const paymentResponse = await instance.orders.create(options);
    return paymentResponse;
  } catch (error) {
    return error;
  }
};

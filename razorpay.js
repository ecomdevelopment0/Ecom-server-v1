import Razorpay from 'razorpay';

const instance = new Razorpay({
    key_id: process.env.razorpay_id,
    key_secret: process.env.razorpay_secret
});

export default instance;
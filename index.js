import dotenv from "dotenv";
dotenv.config('./config.env');

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import error from "./Error/error.js"
import adminRoutes from "./routes/admin/admins.js";
import userRoutes from "./routes/user/users.js";
import productRoutes from './routes/product/products.js'
import brandRoutes from "./routes/product/brands.js";
import categoryRoutes from "./routes/product/categories.js";
import reviewRoutes from "./routes/product/reviews.js";

const app = express();
const port = process.env.PORT || 4001;

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(adminRoutes);
app.use(userRoutes);
app.use(brandRoutes);
app.use(categoryRoutes);
app.use(productRoutes);
app.use(reviewRoutes);


app.get("/", (req, res) => {
  res.send("Welcome to Ecom default home page ...!");
});

app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});

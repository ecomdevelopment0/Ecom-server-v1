import { DataTypes, Sequelize } from "sequelize";

import { sequelize } from "../../dbconfig.js";

const Product = sequelize.define("product", {
  productId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  imageName: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  imageURL: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(500),
  },
  marketPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  actualPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  inStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  ratings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
  },
  onSale: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
});

export default Product;
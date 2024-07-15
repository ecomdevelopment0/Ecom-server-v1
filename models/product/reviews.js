import { DataTypes, UUIDV4 } from "sequelize";

import { sequelize } from "../../dbconfig.js";

const Review = sequelize.define("reviews", {
    reviewId: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
    },
    review: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    profileImage: {
        type: DataTypes.STRING,
        defaultValue:'https://res.cloudinary.com/twitter-clone-media/image/upload/v1597737557/user_wt3nrc.png'
    },
    stars: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
});

export default Review;
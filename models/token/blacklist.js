import { DataTypes } from "sequelize";

import { sequelize } from "../../dbconfig.js";

export const Blacklist = sequelize.define("blacklists", {
    refreshToken: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
    }
});



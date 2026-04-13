const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const platformItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      // e.g. kg, piece, box, litre, dozen — admin fix karega
    },

    image: {
      type: String,
      default: null,
      // Firebase URL — folder: item-images/{categoryName}/
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["PlatformItem"] ||
  El_Distributor.model("PlatformItem", platformItemSchema);

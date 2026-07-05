// const mongoose = require("mongoose");
// const { El_Distributor } = require("../config/db");

// const platformItemSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//       unique: true,
//     },

//     categoryId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Category",
//       required: true,
//     },

//     unit: {
//       type: String,
//       required: true,
//       trim: true,
//       // e.g. kg, piece, box, litre, dozen — admin fix karega
//     },

//     image: {
//       type: String,
//       default: null,
//       // Firebase URL — folder: item-images/{categoryName}/
//     },

//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   { timestamps: true }
// );

// module.exports =
//   El_Distributor.models["PlatformItem"] ||
//   El_Distributor.model("PlatformItem", platformItemSchema);



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

    unitType: {
      type: String,
      required: true,
      enum: ["weight", "volume"],
      // weight → kg/g, volume → ml/L
    },

    unit: {
      type: String,
      required: true,
      enum: [
        // Weight
        "50g, 100g", "250g","330g", "500g", "750g", "1kg", "2kg", "5kg",
        // Volume
        "50ml, 100ml", "250ml", "330ml", "500ml", "750ml", "1L", "1.5L", "2L", "5L",
      ],
    },

    image: {
      type: String,
      default: null,
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
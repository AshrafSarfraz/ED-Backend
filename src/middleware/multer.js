// 📁 middleware/multer.js
const multer = require("multer");
const path   = require("path");
const { RULES, describe } = require("../config/uploadRules");

// Store in memory — we pipe directly to Firebase, no disk needed
const storage = multer.memoryStorage();

// Rules config se filter banao — messages me exact limits bhi bata do,
// taake user ko sirf "invalid file" na dikhe.
const makeFilter = (kind) => (req, file, cb) => {
  const rule = RULES[kind];
  const ext  = path.extname(file.originalname || "").toLowerCase();

  const mimeOk = rule.mimeTypes.includes(file.mimetype);
  const extOk  = rule.extensions.includes(ext);

  if (mimeOk || extOk) return cb(null, true);

  const err = new Error(`Invalid file type. Allowed: ${describe(kind)}`);
  err.status = 400;
  err.code   = "INVALID_FILE_TYPE";
  cb(err, false);
};

const makeUpload = (kind) =>
  multer({
    storage,
    fileFilter: makeFilter(kind),
    limits: { fileSize: RULES[kind].maxSize },
  });

const uploadImage    = makeUpload("image");
const uploadDocument = makeUpload("document");

// ─── Default export = image uploader ──────────────────────
//  Pehle bhi yahi behaviour tha (5MB, jpeg/png/webp), isliye saari
//  purani `require("../middleware/multer")` calls waise ki waise chalengi.
module.exports = uploadImage;

// ─── Named extras ─────────────────────────────────────────
module.exports.uploadImage    = uploadImage;
module.exports.uploadDocument = uploadDocument;   // PDF bhi allowed, 10MB
module.exports.RULES          = RULES;
module.exports.describe       = describe;

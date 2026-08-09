// 📁 config/uploadRules.js
// ═══════════════════════════════════════════════════════
//  UPLOAD RULES — ek hi jagah. Backend (multer) aur frontend (FileInput)
//  dono yahi rules dikhate hain, taake user ko pehle se pata ho ke
//  kitni size aur kaunsi extension chalegi — upload karne ke BAAD error na aaye.
//
//  Frontend copy: ED-AdminPanel/src/config/uploadRules.js (same values)
//  Public API:    GET /api/upload-rules
// ═══════════════════════════════════════════════════════

const MB = 1024 * 1024;

const RULES = {
  // Product images, banners, logos, receipts, return photos
  image: {
    label:      "Image",
    maxSizeMB:  5,
    maxSize:    5 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes:  ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    accept:     "image/jpeg,image/png,image/webp",
  },

  // Trade license, QID, signed contracts, PDC — PDF bhi chalega
  document: {
    label:      "Document",
    maxSizeMB:  10,
    maxSize:    10 * MB,
    extensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes:  ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"],
    accept:     "application/pdf,image/jpeg,image/png,image/webp",
  },
};

// "PDF, JPG, PNG, WEBP · max 10MB"
const describe = (kind = "image") => {
  const r = RULES[kind] || RULES.image;
  const exts = r.extensions.map(e => e.replace(".", "").toUpperCase()).join(", ");
  return `${exts} · max ${r.maxSizeMB}MB`;
};

module.exports = { RULES, describe, MB };

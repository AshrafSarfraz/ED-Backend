// Menu item photos ke liye do kaam: upload aur cleanup.
// Upload wahi shared helper karta hai jo baaki El Distributor use karta hai,
// taake storage me sab kuch ek hi tareeqe se jaye.

const path = require('path');
const { bucket } = require('../../config/firebaseAdmin');
const { uploadToFirebase } = require('../../config/uploadToFirebase');
const { RULES, describe } = require('../../config/uploadRules');
const S = require('./sanitize');

const MENU_FOLDER = 'inventory/menu-items';

const isFirebaseUrl = (url) =>
  typeof url === 'string' && url.startsWith('https://firebasestorage.googleapis.com/');

/* multer memory file -> public URL. File na ho to khali string.
   multer pehle hi type/size check kar chuka hota hai; ye dobara check
   isliye hai ke controller kisi aur raste se bhi call ho sake. */
async function saveImage(file, folder = MENU_FOLDER) {
  if (!file || !file.buffer || !file.buffer.length) return '';

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!RULES.image.extensions.includes(ext)) {
    throw S.bad(`Ye image format allowed nahi. ${describe('image')}`);
  }
  if (file.size > RULES.image.maxSize) {
    throw S.bad(`Image bohat bari hai. ${describe('image')}`);
  }

  return uploadToFirebase(file.buffer, file.originalname, folder);
}

/* Purani file storage se hata do. Best effort - yahan fail hone se menu item
   ka save nahi rukna chahiye, bas ek orphan file reh jayegi. */
async function deleteImage(url) {
  if (!isFirebaseUrl(url)) return false;
  try {
    const m = /\/o\/([^?]+)/.exec(url);
    if (!m) return false;
    await bucket.file(decodeURIComponent(m[1])).delete({ ignoreNotFound: true });
    return true;
  } catch (err) {
    console.warn('[inventory/image] purani file delete nahi hui:', err.message);
    return false;
  }
}

module.exports = { saveImage, deleteImage, isFirebaseUrl, MENU_FOLDER };

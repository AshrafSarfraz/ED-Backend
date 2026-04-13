// config/uploadToFirebase.js
const { bucket } = require("./firebaseAdmin");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

/**
 * Upload a file buffer to Firebase Storage.
 *
 * @param {Buffer}  fileBuffer   - File data
 * @param {string}  originalName - Original filename (used to extract extension)
 * @param {string}  folder       - Storage folder e.g. 'profile-images', 'documents/qid'
 * @returns {Promise<string>}    - Public download URL
 */
async function uploadToFirebase(fileBuffer, originalName, folder = "uploads") {
  const ext      = path.extname(originalName);           // e.g. ".jpg"
  const fileName = `${folder}/${uuidv4()}${ext}`;        // unique path
  const token    = uuidv4();                             // download token

  const file = bucket.file(fileName);

  await file.save(fileBuffer, {
    metadata: {
      contentType: `image/${ext.replace(".", "")}`,
      metadata: { firebaseStorageDownloadTokens: token },
    },
    public: false,
  });

  // Construct public URL
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const bucket_name = process.env.FIREBASE_STORAGE_BUCKET;
  const encodedPath = encodeURIComponent(fileName);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket_name}/o/${encodedPath}?alt=media&token=${token}`;

  return url;
}

module.exports = { uploadToFirebase };
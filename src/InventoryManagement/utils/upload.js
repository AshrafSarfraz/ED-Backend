// CSV upload middleware.
// multer install ho to multipart file chalega, warna JSON body ({csv} / {rows}) se kaam chalega.

let upload = null;
try {
  const multer = require('multer');
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },   // 2 MB
    fileFilter: (req, file, cb) => {
      const ok = /\.(csv|txt)$/i.test(file.originalname || '') ||
        ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream']
          .includes(file.mimetype);
      cb(ok ? null : new Error('Sirf .csv file allowed hai'), ok);
    },
  }).single('file');
} catch (_) {
  // multer installed nahi -> JSON-only mode
}

const csvUpload = (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) return next();

  if (!upload) {
    return res.status(500).json({
      message: 'File upload ke liye multer chahiye. Run: npm i multer  (ya JSON body me { csv: "..." } bhejo)',
    });
  }

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
};

module.exports = { csvUpload };

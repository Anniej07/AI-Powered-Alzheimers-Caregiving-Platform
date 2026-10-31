const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const mkdirSafe = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const base = process.env.UPLOAD_PATH || './uploads';
    const sub  = file.fieldname === 'prescription' ? 'prescriptions'
               : file.fieldname === 'profileImage'  ? 'profiles'
               : 'misc';
    const dest = path.join(base, sub);
    mkdirSafe(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const ok  = file.fieldname === 'prescription' ? /^(pdf|jpg|jpeg|png)$/.test(ext)
             : file.fieldname === 'profileImage'  ? /^(jpg|jpeg|png|webp)$/.test(ext)
             : false;
  ok ? cb(null, true) : cb(new Error(`File type .${ext} not allowed for ${file.fieldname}`), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

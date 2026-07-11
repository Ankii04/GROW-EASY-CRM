import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { importCsv, importCsvSync } from '../controllers/import.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (isCsv) return cb(null, true);
    cb(new Error('Only .csv files are supported'));
  },
});

export const importRouter = Router();

importRouter.post('/import', upload.single('file'), importCsv);
importRouter.post('/import/sync', upload.single('file'), importCsvSync);

import multer from "multer";
import { AppError } from "../errors/app-error";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new AppError("Only PDF files are allowed", 400));
  }

  cb(null, true);
};

export const uploadRecruiterDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
  },
}).fields([
  {
    name: "companyLicensePaper",
    maxCount: 1,
  },
  {
    name: "selfDocument",
    maxCount: 1,
  },
]);
import { Router } from "express";

import { RecruiterController } from "./recruiter.controller";
import {
  registerRecruiterSchema,
  verifyRecruiterOtpSchema,
} from "./recruiter.validation";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";
import { uploadRecruiterDocuments } from "../../app/common/middleware/upload-document.middleware";

const router = Router();

router.post(
  "/register",
  uploadRecruiterDocuments,
  validateRequest(registerRecruiterSchema),
  asyncHandler(RecruiterController.register)
);

router.post(
  "/verify-otp",
  validateRequest(verifyRecruiterOtpSchema),
  asyncHandler(RecruiterController.verifyOtp)
);

export default router;;
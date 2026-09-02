import { Router } from "express";

import { RecruiterController } from "./recruiter.controller";
import { registerRecruiterSchema } from "./recruiter.validation";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";


const router = Router();

router.post(
  "/register",
  validateRequest(registerRecruiterSchema),
  asyncHandler(RecruiterController.register)
);

export default router;
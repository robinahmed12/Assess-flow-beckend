import { Router } from "express";

import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";

import {
  googleLoginSchema,
  loginSchema,
  registerSchema,
  verifyRegistrationOtpSchema,
} from "./auth.validation";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(AuthController.register)
);

router.post(
  "/verify-registration-otp",
  validateRequest(verifyRegistrationOtpSchema),
  asyncHandler(AuthController.verifyRegistrationOtp)
);

router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(AuthController.login)
);

router.post(
  "/google",
  validateRequest(googleLoginSchema),
  asyncHandler(AuthController.googleLogin)
);

router.get(
  "/me",
  authenticate,
  asyncHandler(AuthController.getCurrentUser)
);

export default router;

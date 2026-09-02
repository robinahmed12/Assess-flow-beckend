import { Router } from "express";

import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";

import {
  loginSchema,
  registerSchema,
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
  "/login",
  validateRequest(loginSchema),
  asyncHandler(AuthController.login)
);

router.get(
  "/me",
  authenticate,
  asyncHandler(AuthController.getCurrentUser)
);

export default router;
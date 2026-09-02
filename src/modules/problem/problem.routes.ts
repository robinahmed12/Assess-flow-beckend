import { Router } from "express";
import { UserRole } from "@prisma/client";

import { ProblemController } from "./problem.controller";

import {
  createProblemSchema,
  updateProblemSchema,
  problemIdSchema,
} from "./problem.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.use(authenticate);

router.use(authorize(UserRole.RECRUITER));

router.post(
  "/",
  validateRequest(createProblemSchema),
  asyncHandler(ProblemController.create),
);

router.get("/", asyncHandler(ProblemController.findAll));

router.get(
  "/:id",
  validateRequest(problemIdSchema),
  asyncHandler(ProblemController.findById),
);

router.patch(
  "/:id",
  validateRequest(updateProblemSchema),
  asyncHandler(ProblemController.update),
);

router.delete(
  "/:id",
  validateRequest(problemIdSchema),
  asyncHandler(ProblemController.archive),
);

export default router;

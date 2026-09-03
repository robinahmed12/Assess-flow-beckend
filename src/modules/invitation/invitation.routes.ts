import { Router } from "express";
import { UserRole } from "@prisma/client";

import { InvitationController } from "./invitation.controller";

import {
  createInvitationSchema,
  assessmentInvitationIdSchema,
} from "./invitation.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.use(authenticate);

router.use(authorize(UserRole.RECRUITER));

router.post(
  "/:id/invitations",
  validateRequest(createInvitationSchema),
  asyncHandler(InvitationController.create),
);

router.get(
  "/:id/invitations",
  validateRequest(assessmentInvitationIdSchema),
  asyncHandler(InvitationController.findByAssessment),
);

export default router;

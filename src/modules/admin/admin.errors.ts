import { AppError } from "../../app/common/errors/app-error";

export const adminErrors = {
  unauthorized: () => new AppError("Unauthorized", 401),

  forbidden: () => new AppError("Forbidden", 403),

  userNotFound: () => new AppError("User not found", 404),

  cannotUpdateSelf: () =>
    new AppError(
      "Admin cannot change their own status from this endpoint",
      409
    ),
};
export class AdminError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const adminErrors = {
  unauthorized: () => new AdminError("Unauthorized", 401),
  forbidden: () => new AdminError("Forbidden", 403),
  userNotFound: () => new AdminError("User not found", 404),
  cannotUpdateSelf: () => new AdminError("Admin cannot change their own status from this endpoint", 409),
};

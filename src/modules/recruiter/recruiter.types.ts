export interface RegisterRecruiterInput {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

export interface VerifyRecruiterOtpInput {
  email: string;
  otp: string;
}

export interface PendingRecruiterRegistration {
  name: string;
  email: string;
  passwordHash: string;
  companyName: string;
  companyLicensePaperUrl: string;
  companyLicensePaperPublicId: string;
  selfDocumentUrl: string;
  selfDocumentPublicId: string;
  otp: string;
}
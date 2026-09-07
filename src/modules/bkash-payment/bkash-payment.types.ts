export interface BkashConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  callbackUrl: string;
}

export interface BkashGrantTokenResponse {
  statusCode?: string;
  statusMessage?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: string | number;
  [key: string]: unknown;
}

export interface BkashCreatePaymentResponse {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  bkashURL?: string;
  callbackURL?: string;
  successCallbackURL?: string;
  failureCallbackURL?: string;
  cancelledCallbackURL?: string;
  amount?: string;
  currency?: string;
  intent?: string;
  merchantInvoiceNumber?: string;
  transactionStatus?: string;
  [key: string]: unknown;
}

export interface BkashExecutePaymentResponse {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  intent?: string;
  merchantInvoiceNumber?: string;
  paymentExecuteTime?: string;
  [key: string]: unknown;
}

export interface BkashQueryPaymentResponse
  extends BkashExecutePaymentResponse {
  paymentCreateTime?: string;
}

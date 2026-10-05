import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

// Quoted values in `.env` can carry leading/trailing whitespace, which silently
// breaks exact-match comparisons (a trailing space in `GOOGLE_CLIENT_ID` made
// every Google token fail audience verification).
const env = (key: string): string | undefined => process.env[key]?.trim();

export default {
  node_env: env("NODE_ENV"),
  port: env("PORT"),
  database_url: env("DATABASE_URL"),
  jwt_secret: env("JWT_ACCESS_SECRET"),
  jwt_expires_in: env("JWT_ACCESS_EXPIRES_IN") || "1d",

  redis_user: env("REDIS_USER"),
  redis_password: env("REDIS_PASSWORD"),
  redis_host: env("REDIS_HOST"),
  redis_port: env("REDIS_PORT"),
  smtp_user: env("SMTP_USER"),
  smtp_pass: env("SMTP_PASS"),
  cloudinary_cloud_name: env("CLOUDINARY_CLOUD_NAME"),
  cloudinary_api_key: env("CLOUDINARY_API_KEY"),
  cloudinary_api_secret: env("CLOUDINARY_API_SECRET"),
  frontend_url: env("FRONTEND_URL"),
  stripe_secret_key: env("STRIPE_SECRET_KEY"),
  stripe_webhook_secret: env("STRIPE_WEBHOOK_SECRET"),
  stripe_success_url: env("STRIPE_SUCCESS_URL"),
  stripe_cancel_url: env("STRIPE_CANCEL_URL"),
  google_client_id: env("GOOGLE_CLIENT_ID")!,
};
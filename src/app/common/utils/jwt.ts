import jwt from "jsonwebtoken";
import { JwtPayload } from "../../../modules/auth/auth.types";
import config from "../../config";



export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwt_secret as string, {
    expiresIn: config.jwt_expires_in as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt_secret as string) as JwtPayload;
};
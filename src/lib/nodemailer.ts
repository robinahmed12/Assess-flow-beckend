import nodemailer from "nodemailer"
import config from "../app/config";


export const transporter = nodemailer.createTransport({
    service : "gmail",
    auth : {
        user : config.smtp_user,
        pass : config.smtp_pass
    }
});
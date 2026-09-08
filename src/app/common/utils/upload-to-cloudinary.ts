import streamifier from "streamifier";
import cloudinary from "../../../lib/cloudinary";

type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
};

export const uploadBufferToCloudinary = async (
  file: Express.Multer.File,
  folder: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",
        public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
          format: result.format,
        });
      }
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};
import { v2 as cloudinary } from "cloudinary";
function ensureConfig() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) {
        throw Object.assign(new Error("Cloudinary not configured"), { status: 503 });
    }
    cloudinary.config({ cloud_name, api_key, api_secret });
}
export function signUploadParams(folder) {
    ensureConfig();
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(params, api_secret);
    return {
        signature,
        timestamp,
        folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
}

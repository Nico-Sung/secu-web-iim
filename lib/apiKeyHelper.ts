import crypto from "crypto";

const PREFIX = "sk";
const PREFIX_LENGTH = 8;
const SECRET_LENGTH = 32;

export function generateApiKey() {
    const randomPrefix = crypto.randomBytes(PREFIX_LENGTH / 2).toString("hex");
    const prefix = `${PREFIX}_${randomPrefix}`;
    const secret = crypto.randomBytes(SECRET_LENGTH / 2).toString("hex");
    const plainTextKey = `${prefix}_${secret}`;
    const hash = crypto.createHash("sha256").update(secret).digest("hex");
    return { plainTextKey, prefix, hash };
}

export function splitApiKey(plainTextKey: string) {
    const parts = plainTextKey.split("_");
    if (parts.length !== 3 || parts[0] !== PREFIX) {
        return null;
    }
    const prefix = `${parts[0]}_${parts[1]}`;
    const secret = parts[2];
    return { prefix, secret };
}

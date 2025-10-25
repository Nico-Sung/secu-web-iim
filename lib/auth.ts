import jwt from "jsonwebtoken";
import { supabase } from "./supabaseClient";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest, MyJwtPayload } from "../types/auth";
import type { ApiKey, Role, UserWithRole } from "../types/db";
import { splitApiKey } from "./apiKeyHelper";
import crypto from "crypto";

type AuthApiHandler = (
    req: AuthenticatedRequest,
    res: NextApiResponse
) => Promise<void> | void;

type PermissionKeys = keyof Omit<Role, "id" | "name">;
type RequiredPermissions = Partial<Record<PermissionKeys, boolean>>;

export function withAuth(
    handler: AuthApiHandler,
    requiredPermissions: RequiredPermissions = {}
) {
    return async (req: any, res: NextApiResponse) => {
        let user: UserWithRole | null = null;
        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers["x-api-key"];

        try {
            if (apiKeyHeader && typeof apiKeyHeader === "string") {
                const keyParts = splitApiKey(apiKeyHeader);
                if (!keyParts) {
                    return res
                        .status(401)
                        .json({ error: "Clé API mal formatée." });
                }

                const { prefix, secret } = keyParts;

                const { data: apiKeyData, error: keyError } = await supabase
                    .from("api_keys")
                    .select("key_hash, user_id")
                    .eq("prefix", prefix)
                    .single();

                if (keyError || !apiKeyData) {
                    return res.status(401).json({
                        error: "Clé API invalide (préfixe non trouvé).",
                    });
                }

                const incomingHash = crypto
                    .createHash("sha256")
                    .update(secret)
                    .digest("hex");

                const storedHash = apiKeyData.key_hash;

                if (incomingHash.length !== 64 || storedHash.length !== 64) {
                    return res
                        .status(401)
                        .json({ error: "Erreur de hachage de clé." });
                }

                const isMatch = crypto.timingSafeEqual(
                    Buffer.from(incomingHash, "hex"),
                    Buffer.from(storedHash, "hex")
                );

                if (!isMatch) {
                    return res.status(401).json({
                        error: "Clé API invalide (secret incorrect).",
                    });
                }

                const { data: keyUser, error: userError } = await supabase
                    .from("users")
                    .select("*, roles(*)")
                    .eq("id", apiKeyData.user_id)
                    .single();

                if (userError || !keyUser) {
                    return res.status(401).json({
                        error: "Utilisateur de la clé API non trouvé.",
                    });
                }

                user = keyUser as UserWithRole;

                supabase
                    .from("api_keys")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("prefix", prefix)
                    .then();
            } else if (authHeader) {
                const token = authHeader.split(" ")[1];
                if (!token) {
                    return res
                        .status(401)
                        .json({ error: "Token mal formaté." });
                }

                const decodedPayload = jwt.verify(
                    token,
                    process.env.JWT_SECRET!
                ) as MyJwtPayload;

                const { data: jwtUser, error: userError } = await supabase
                    .from("users")
                    .select("*, roles(*)")
                    .eq("id", decodedPayload.userId)
                    .single();

                if (userError || !jwtUser) {
                    return res
                        .status(401)
                        .json({ error: "Utilisateur du token non trouvé." });
                }

                const tokenIssuedAt = decodedPayload.iat!;
                const passwordChangedAt =
                    new Date(jwtUser.password_changed_at).getTime() / 1000;

                if (tokenIssuedAt < passwordChangedAt) {
                    return res.status(401).json({
                        error: "Token expiré (changement de mot de passe).",
                    });
                }

                user = jwtUser as UserWithRole;
            } else {
                return res
                    .status(401)
                    .json({ error: "Aucun token ou clé API fourni." });
            }

            if (!user) {
                return res
                    .status(401)
                    .json({ error: "Authentification échouée." });
            }

            const userRole = user.roles;
            if (!userRole) {
                return res
                    .status(403)
                    .json({ error: "Configuration de rôle invalide." });
            }

            for (const perm in requiredPermissions) {
                const key = perm as PermissionKeys;
                if (
                    requiredPermissions[key] === true &&
                    userRole[key] !== true
                ) {
                    const authMethod = apiKeyHeader ? "Clé API" : "JWT";
                    return res.status(403).json({
                        error: `Permission refusée (${key}). (Auth via ${authMethod})`,
                    });
                }
            }

            delete (user as any).password_hash;
            (req as AuthenticatedRequest).user = user;

            return handler(req as AuthenticatedRequest, res);
        } catch (error) {
            if (
                error instanceof jwt.JsonWebTokenError ||
                error instanceof jwt.TokenExpiredError
            ) {
                return res.status(401).json({ error: error.message });
            }
            console.error(
                "Erreur inattendue dans le middleware d'auth:",
                error
            );
            return res
                .status(500)
                .json({ error: "Erreur interne du serveur." });
        }
    };
}

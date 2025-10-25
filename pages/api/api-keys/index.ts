import { withAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabaseClient";
import { generateApiKey } from "../../../lib/apiKeyHelper";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../../types/auth";
import type { ApiKeyInfo } from "../../../types/db";

type ErrorResponse = { error: string };
type CreateKeyResponse = {
    message: string;
    newKey: string;
    keyInfo: ApiKeyInfo;
};

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<ApiKeyInfo[] | CreateKeyResponse | ErrorResponse>
) {
    if (!req.headers.authorization) {
        res.status(403).json({
            error: "La gestion des clés API nécessite une session utilisateur (JWT).",
        });
        return;
    }

    const userId = req.user.id;

    if (req.method === "GET") {
        try {
            const { data, error } = await supabase
                .from("api_keys")
                .select("id, name, prefix, created_at, last_used_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            res.status(200).json(data || []);
            return;
        } catch (error: any) {
            res.status(500).json({
                error: "Erreur lors de la récupération des clés.",
            });
            return;
        }
    }

    if (req.method === "POST") {
        try {
            const { name } = req.body;
            if (!name || typeof name !== "string" || name.length < 3) {
                res.status(400).json({
                    error: "Un 'name' (string, min 3 caractères) est requis.",
                });
                return;
            }

            const { plainTextKey, prefix, hash } = generateApiKey();

            const { data: newKeyInfo, error } = await supabase
                .from("api_keys")
                .insert({
                    name: name,
                    user_id: userId,
                    prefix: prefix,
                    key_hash: hash,
                })
                .select("id, name, prefix, created_at, last_used_at")
                .single();

            if (error) {
                if (error.code === "23505") {
                    res.status(409).json({
                        error: "Conflit de génération de clé. Veuillez réessayer.",
                    });
                    return;
                }
                throw error;
            }

            res.status(201).json({
                message:
                    "Clé API générée avec succès. Stockez-la en lieu sûr, vous ne la reverrez plus.",
                newKey: plainTextKey,
                keyInfo: newKeyInfo,
            });
            return;
        } catch (error: any) {
            res.status(500).json({
                error: "Erreur lors de la création de la clé.",
            });
            return;
        }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end("Method Not Allowed");
    return;
}

export default withAuth(handler);

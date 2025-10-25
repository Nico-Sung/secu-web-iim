import { withAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabaseClient";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../../types/auth";

type ErrorResponse = { error: string };

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<void | ErrorResponse>
) {
    if (req.method !== "DELETE") {
        res.setHeader("Allow", ["DELETE"]);
        res.status(405).end("Method Not Allowed");
        return;
    }

    if (!req.headers.authorization) {
        res.status(403).json({
            error: "La gestion des clés API nécessite une session utilisateur (JWT).",
        });
        return;
    }

    try {
        const userId = req.user.id;
        const { keyId } = req.query;

        if (typeof keyId !== "string") {
            res.status(400).json({ error: "ID de clé invalide." });
            return;
        }

        const { error, count } = await supabase
            .from("api_keys")
            .delete()
            .eq("id", keyId)
            .eq("user_id", userId);

        if (error) throw error;

        if (count === 0) {
            res.status(404).json({
                error: "Clé non trouvée ou non autorisée.",
            });
            return;
        }

        res.status(204).end();
        return;
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            error: "Erreur lors de la suppression de la clé.",
        });
        return;
    }
}

export default withAuth(handler);

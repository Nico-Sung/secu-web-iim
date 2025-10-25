import { withAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../types/auth";

type ResponseData =
    | {
          message: string;
      }
    | {
          error: string;
      };

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        res.status(405).end("Method Not Allowed");
        return;
    }

    const { newPassword } = req.body;
    if (
        !newPassword ||
        typeof newPassword !== "string" ||
        newPassword.length < 8
    ) {
        return res.status(400).json({
            error: "Nouveau mot de passe invalide (min 8 caractères).",
        });
    }

    try {
        const userId = req.user.id;
        const passwordHash = await bcrypt.hash(newPassword, 10);

        const { error } = await supabase
            .from("users")
            .update({
                password_hash: passwordHash,
                password_changed_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) throw error;

        res.status(200).json({
            message: "Mot de passe mis à jour avec succès.",
        });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la mise à jour." });
        return;
    }
}

export default withAuth(handler);

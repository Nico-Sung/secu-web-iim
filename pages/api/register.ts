import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";

type ErrorResponse = {
    error: string;
};

type SuccessResponse = {
    id: string;
    name: string;
    email: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { name, email, password } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                error: "Champs invalides. Le mot de passe (string) doit faire au moins 8 caractères.",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const { data: userRole, error: roleError } = await supabase
            .from("roles")
            .select("id")
            .eq("name", "USER")
            .single();

        if (roleError || !userRole) {
            console.error(
                'Erreur: Le rôle "USER" par défaut est introuvable.',
                roleError
            );
            return res
                .status(500)
                .json({ error: "Erreur de configuration serveur." });
        }

        const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert({
                name: name,
                email: email,
                password_hash: passwordHash,
                role_id: userRole.id,
            })
            .select("id, name, email")
            .single();

        if (insertError) {
            if (insertError.code === "23505") {
                return res
                    .status(409)
                    .json({ error: "Cet email est déjà utilisé." });
            }
            console.error(insertError);
            return res
                .status(500)
                .json({ error: "Erreur lors de la création du compte." });
        }

        if (!newUser) {
            return res
                .status(500)
                .json({ error: "Erreur lors de la création du compte." });
        }

        return res.status(201).json(newUser);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur interne du serveur." });
    }
}

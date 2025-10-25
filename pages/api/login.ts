import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserWithRole } from "../../types/db";
import { MyJwtPayload } from "../../types/auth";

const LOGIN_ATTEMPT_COOLDOWN = 5000;

type ResponseData =
    | {
          token: string;
      }
    | {
          error: string;
      };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    try {
        const { data, error: userError } = await supabase
            .from("users")
            .select("*, roles(*)")
            .eq("email", email)
            .single();

        if (userError || !data) {
            return res.status(401).json({ error: "Identifiants invalides." });
        }

        const user = data as UserWithRole;

        if (user.last_login_attempt_at) {
            const lastAttemptTime = new Date(
                user.last_login_attempt_at
            ).getTime();
            const now = Date.now();

            if (now - lastAttemptTime < LOGIN_ATTEMPT_COOLDOWN) {
                return res.status(429).json({
                    error: "Trop de tentatives. Veuillez réessayer dans quelques secondes.",
                });
            }
        }

        await supabase
            .from("users")
            .update({ last_login_attempt_at: new Date().toISOString() })
            .eq("id", user.id);

        if (!user.roles || user.roles.can_post_login === false) {
            return res.status(403).json({
                error: "Ce compte n'a pas la permission de se connecter.",
            });
        }

        const { data: userWithHash } = await supabase
            .from("users")
            .select("password_hash")
            .eq("id", user.id)
            .single();

        if (!userWithHash) {
            return res.status(401).json({ error: "Identifiants invalides." });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            userWithHash.password_hash
        );
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Identifiants invalides." });
        }

        const payload: Omit<MyJwtPayload, "iat" | "exp"> = {
            userId: user.id,
            email: user.email,
            role: user.roles.name,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET!, {
            expiresIn: "1h",
        });

        return res.status(200).json({ token: token });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur interne du serveur." });
    }
}

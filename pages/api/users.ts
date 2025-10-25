import { withAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../types/auth";

type UserListResponse = {
    id: string;
    name: string;
    email: string;
    roles: { name: string }[] | null;
}[];

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<UserListResponse | { error: string }>
) {
    try {
        const { data: users, error } = await supabase
            .from("users")
            .select("id, name, email, roles(name)");

        if (error) throw error;

        res.status(200).json(users || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erreur lors de la récupération des utilisateurs.",
        });
    }
}

export default withAuth(handler, {
    can_get_users: true,
});

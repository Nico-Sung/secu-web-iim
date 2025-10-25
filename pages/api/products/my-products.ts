import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { AuthenticatedRequest } from "@/types/auth";
import { Product } from "@/types/db";
import { NextApiResponse } from "next";

type ErrorResponse = { error: string };

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<Product[] | ErrorResponse>
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        res.status(405).end("Method Not Allowed");
        return;
    }

    try {
        const userId = req.user.id;

        const { data: products, error } = await supabase
            .from("products")
            .select("*") 
            .eq("created_by", userId); 

        if (error) {
            console.error("Erreur Supabase (my-products):", error);
            res.status(500).json({
                error: "Erreur lors de la récupération des produits.",
            });
            return;
        }

        res.status(200).json(products || []);
        return;
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Erreur interne du serveur." });
        return;
    }
}

export default withAuth(handler, {
    can_get_my_products: true,
});

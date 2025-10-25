import { withAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabaseClient";
import { createShopifyProduct } from "../../../lib/shopify";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../../types/auth";
import type { Product } from "../../../types/db";

type ErrorResponse = { error: string };

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<Product | Product[] | ErrorResponse>
) {
    if (req.method === "POST") {
        if (!req.user.roles?.can_post_products) {
            res.status(403).json({
                error: "Permission refusée (can_post_products).",
            });
            return;
        }
        await handlePost(req, res);
        return;
    }

    if (req.method === "GET") {
        if (!req.user.roles?.can_get_all_products) {
            res.status(403).json({
                error: "Permission refusée (can_get_all_products).",
            });
            return;
        }
        await handleGet(req, res);
        return;
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end("Method Not Allowed");
    return;
}

async function handlePost(
    req: AuthenticatedRequest,
    res: NextApiResponse<Product | ErrorResponse>
) {
    try {
        const { name, price, image_url } = req.body;

        if (!name || !price || typeof price !== "string") {
            res.status(400).json({
                error: "Le 'name' (string) et le 'price' (string) sont requis.",
            });
            return;
        }

        if (image_url) {
            if (!req.user.roles?.can_post_product_image) {
                res.status(403).json({
                    error: "Permission refusée. Le rôle PREMIUM est requis pour ajouter une image.",
                });
                return;
            }
            if (typeof image_url !== "string") {
                res.status(400).json({
                    error: "Le champ 'image_url' doit être une URL (string).",
                });
                return;
            }
        }

        let shopifyId: string;
        try {
            shopifyId = await createShopifyProduct(name, price, image_url);
        } catch (shopifyError: any) {
            console.error("Échec de la création Shopify:", shopifyError);
            res.status(502).json({
                error: `Erreur lors de la création Shopify: ${shopifyError.message}`,
            });
            return;
        }

        const userId = req.user.id;
        const { data: newProduct, error: supabaseError } = await supabase
            .from("products")
            .insert({
                shopify_id: shopifyId,
                created_by: userId,
            })
            .select()
            .single();

        if (supabaseError) {
            console.error(
                "Erreur Critique: Produit créé sur Shopify mais échec sauvegarde BDD",
                supabaseError
            );
            res.status(500).json({
                error: "Produit créé sur Shopify, mais échec de la sauvegarde locale.",
            });
            return;
        }

        res.status(201).json(newProduct);
        return;
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Erreur interne du serveur." });
        return;
    }
}

async function handleGet(
    req: AuthenticatedRequest,
    res: NextApiResponse<Product[] | ErrorResponse>
) {
    try {
        const { data: products, error } = await supabase.from("products")
            .select(`
        *,
        users ( name )
      `);

        if (error) {
            console.error("Erreur Supabase (GET /products):", error);
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

export default withAuth(handler);

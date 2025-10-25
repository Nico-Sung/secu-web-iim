import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";
import { ShopifyOrderWebhook } from "@/lib/shopify";

export const config = {
    api: {
        bodyParser: false,
    },
};

async function buffer(readable: NextApiRequest) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

type SalesUpdateItem = {
    product_shopify_id: number;
    quantity_sold: number;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).end("Method Not Allowed");
    }

    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("SHOPIFY_WEBHOOK_SECRET non défini.");
        return res
            .status(500)
            .json({ error: "Configuration serveur invalide." });
    }

    let rawBody: Buffer;
    let hmacHeader: string;

    try {
        rawBody = await buffer(req);
        hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;

        if (!hmacHeader) {
            throw new Error("Signature HMAC manquante.");
        }

        const hash = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("base64");

        const hmacBuffer = Buffer.from(hmacHeader, "base64");
        const hashBuffer = Buffer.from(hash, "base64");

        const isSignatureValid =
            hmacBuffer.length === hashBuffer.length &&
            crypto.timingSafeEqual(hmacBuffer, hashBuffer);

        if (!isSignatureValid) {
            console.warn("Signature HMAC invalide reçue.");
            return res.status(401).json({ error: "Signature invalide." });
        }

        console.log("Webhook Shopify vérifié avec succès !");

        const order = JSON.parse(rawBody.toString()) as ShopifyOrderWebhook;

        console.log(`[Webhook Log] Commande reçue: ${order.id}`);

        const itemsToUpdate: SalesUpdateItem[] = order.line_items
            .filter((item) => item.product_id != null)
            .map((item) => ({
                product_shopify_id: item.product_id!,
                quantity_sold: item.quantity,
            }));

        if (itemsToUpdate.length === 0) {
            console.log(
                "[Webhook Log] Webhook reçu, mais aucun produit pertinent (product_id=null ou 0 articles)."
            );
            return res
                .status(200)
                .json({ message: "Webhook reçu, aucun produit pertinent." });
        }

        console.log(
            `[Webhook Log] Articles à mettre à jour:`,
            JSON.stringify(itemsToUpdate)
        );

        const { error: rpcError } = await supabase.rpc(
            "increment_sales_counts",
            {
                items: itemsToUpdate,
            }
        );

        if (rpcError) {
            console.error("Erreur RPC Supabase:", rpcError);
            return res.status(200).json({ error: "Erreur base de données." });
        }

        console.log(
            `[Webhook Log] Succès: ${itemsToUpdate.length} types de produits mis à jour.`
        );

        return res.status(200).json({ message: "Ventes mises à jour." });
    } catch (error: any) {
        console.error("Échec du traitement du webhook:", error);
        return res
            .status(500)
            .json({ error: error.message || "Erreur interne." });
    }
}

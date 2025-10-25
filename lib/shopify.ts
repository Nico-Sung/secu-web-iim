const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
const apiToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
const apiVersion = "2024-04";
const shopifyApiUrl = `https://${storeDomain}/admin/api/${apiVersion}`;

export interface ShopifyLineItem {
    product_id: number | null;
    quantity: number;
}

export interface ShopifyOrderWebhook {
    id: number;
    line_items: ShopifyLineItem[];
}

export async function createShopifyProduct(
    title: string,
    price: string,
    imageUrl?: string
): Promise<string> {
    if (!storeDomain || !apiToken) {
        throw new Error(
            "Variables d'environnement Shopify (DOMAIN ou TOKEN) manquantes."
        );
    }

    const endpoint = `${shopifyApiUrl}/products.json`;

    const productPayload: any = {
        title: title,
        variants: [{ price: price }],
    };

    if (imageUrl) {
        productPayload.images = [{ src: imageUrl }];
    }

    const body = {
        product: productPayload,
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": apiToken,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur API Shopify:", errorData);
        throw new Error(
            `Erreur Shopify (${response.status}): ${JSON.stringify(
                errorData.errors
            )}`
        );
    }

    const data = await response.json();

    if (!data.product || !data.product.id) {
        throw new Error("Réponse de l'API Shopify mal formatée.");
    }

    return String(data.product.id);
}

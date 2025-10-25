export interface Role {
    id: string;
    name: string;
    can_post_login: boolean;
    can_get_my_user: boolean;
    can_get_users: boolean;

    can_post_products: boolean;
    can_get_my_products: boolean;
    can_get_all_products: boolean;

    can_post_product_image: boolean;
    can_get_my_bestsellers: boolean;
}

export interface User {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role_id: string;
    last_login_attempt_at: string | null;
    password_changed_at: string;
}

export interface UserWithRole extends Omit<User, "password_hash"> {
    roles: Role | null;
}

export interface Product {
    id: string;
    shopify_id: number;
    created_by: string;
    sales_count: number;
    created_at: string;
}

export interface ApiKey {
    id: string;
    name: string;
    user_id: string;
    prefix: string;
    key_hash: string;
    created_at: string;
    last_used_at: string | null;
}

export interface ApiKeyInfo {
    id: string;
    name: string;
    prefix: string;
    created_at: string;
    last_used_at: string | null;
}

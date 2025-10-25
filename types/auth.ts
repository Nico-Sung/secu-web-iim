import { JwtPayload } from "jsonwebtoken";
import type { NextApiRequest } from "next";
import { UserWithRole } from "./db";


export interface MyJwtPayload extends JwtPayload {
    userId: string;
    email: string;
    role: string;
}

export interface AuthenticatedRequest extends NextApiRequest {
    user: UserWithRole;
}

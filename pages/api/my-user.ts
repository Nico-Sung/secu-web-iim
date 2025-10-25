import { withAuth } from "../../lib/auth";
import type { NextApiResponse } from "next";
import type { AuthenticatedRequest } from "../../types/auth";
import type { UserWithRole } from "../../types/db";

async function handler(
    req: AuthenticatedRequest,
    res: NextApiResponse<UserWithRole>
) {
    res.status(200).json(req.user);
}

export default withAuth(handler, {
    can_get_my_user: true,
});

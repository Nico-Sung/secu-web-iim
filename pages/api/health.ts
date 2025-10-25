import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    test: string;
};

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method === "GET") {
        res.status(200).json({ test: "hello world" });
    } else {
        res.setHeader("Allow", ["GET"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

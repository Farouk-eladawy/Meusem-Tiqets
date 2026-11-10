// Vercel Serverless Function: تسجيل مسح التذكرة في Baserow
const { submitTicketScan } = require("../lib/baserow-tickets");

module.exports = async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const data = typeof req.body === "string"
            ? JSON.parse(req.body || "{}")
            : (req.body || {});

        const result = await submitTicketScan({
            ticketCode: data.ticketCode,
            ticketType: data.ticketType
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({
            error: "حدث خطأ داخلي",
            details: String((error && error.message) || error)
        });
    }
};

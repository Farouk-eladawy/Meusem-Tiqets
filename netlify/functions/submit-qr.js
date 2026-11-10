// دالة Netlify لتسجيل مسح التذكرة في Baserow
const { submitTicketScan } = require("../../lib/baserow-tickets");

exports.handler = async function (event) {
    const json = (statusCode, body) => ({
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method Not Allowed" });
    }

    try {
        const data = JSON.parse(event.body || "{}");
        const result = await submitTicketScan({
            ticketCode: data.ticketCode,
            ticketType: data.ticketType
        });
        return json(result.status, result.body);
    } catch (error) {
        console.error("Error processing request:", error);
        return json(500, {
            error: "حدث خطأ داخلي",
            details: String((error && error.message) || error)
        });
    }
};

// Vercel Serverless Function: تسجيل مسح التذكرة في Airtable
module.exports = async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const data = typeof req.body === "string"
            ? JSON.parse(req.body || "{}")
            : (req.body || {});

        const ticketCode = String(data.ticketCode || "").trim();
        const ticketType = data.ticketType; // "Citadel" أو "Museum"

        if (!ticketCode || !ticketType) {
            return res.status(400).json({ error: "بيانات غير مكتملة" });
        }

        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

        const tableName = ticketType === "Citadel" ? "Citadel" : "Museum";

        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
            console.error("Missing Airtable Environment Variables");
            return res.status(500).json({ error: "إعدادات Airtable غير مكتملة" });
        }

        const headers = {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json"
        };

        const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        const escapeAirtableString = (value) =>
            String(value)
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'");

        const escapedCode = escapeAirtableString(ticketCode);
        const filter = encodeURIComponent(`{Ticket Code}='${escapedCode}'`);

        const checkResponse = await fetch(`${baseUrl}?filterByFormula=${filter}&maxRecords=1`, {
            method: "GET",
            headers
        });

        if (!checkResponse.ok) {
            const errorData = await checkResponse.json().catch(() => ({}));
            console.error("Airtable Check Error:", errorData);
            return res.status(checkResponse.status).json({
                error: "فشل التحقق من التذكرة",
                details: errorData.error || errorData
            });
        }

        const checkData = await checkResponse.json();
        if (checkData.records && checkData.records.length > 0) {
            return res.status(409).json({
                success: false,
                duplicate: true,
                code: ticketCode,
                type: ticketType,
                error: "التذكرة مستخدمة مسبقاً"
            });
        }

        const fieldSets = [
            {
                "Ticket Code": ticketCode,
                Status: "Scanned",
                "Scan Time": new Date().toISOString()
            },
            {
                "Ticket Code": ticketCode,
                Status: "Scanned"
            },
            {
                "Ticket Code": ticketCode
            }
        ];

        let lastError = null;

        for (const fields of fieldSets) {
            const response = await fetch(baseUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ records: [{ fields }] })
            });

            if (response.ok) {
                return res.status(200).json({
                    success: true,
                    code: ticketCode,
                    type: ticketType
                });
            }

            lastError = await response.json().catch(() => ({}));
            console.error("Airtable Error:", lastError);

            const airtableType = lastError && lastError.error && (lastError.error.type || lastError.error);
            if (airtableType && airtableType !== "UNKNOWN_FIELD_NAME" && airtableType !== "INVALID_VALUE_FOR_COLUMN") {
                return res.status(response.status).json({
                    error: "فشل الإرسال إلى Airtable",
                    details: lastError.error || lastError
                });
            }
        }

        return res.status(500).json({
            error: "فشل الإرسال إلى Airtable",
            details: (lastError && lastError.error) || lastError
        });
    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({
            error: "حدث خطأ داخلي",
            details: String((error && error.message) || error)
        });
    }
};

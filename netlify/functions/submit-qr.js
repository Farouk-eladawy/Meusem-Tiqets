// دالة Netlify للتعامل مع Airtable بأمان وتوجيه البيانات للجدول الصحيح
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const json = (statusCode, body) => ({
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    try {
        const data = JSON.parse(event.body || "{}");
        const ticketCode = String(data.ticketCode || "").trim();
        const ticketType = data.ticketType; // "Citadel" أو "Museum"

        if (!ticketCode || !ticketType) {
            return json(400, { error: "بيانات غير مكتملة" });
        }

        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

        const tableName = ticketType === "Citadel" ? "Citadel" : "Museum";

        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
            console.error("Missing Airtable Environment Variables");
            return json(500, { error: "إعدادات Airtable غير مكتملة" });
        }

        const headers = {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json"
        };

        const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        // تهريب آمن لقيم Airtable داخل الصيغة
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
            return json(checkResponse.status, {
                error: "فشل التحقق من التذكرة",
                details: errorData?.error || errorData
            });
        }

        const checkData = await checkResponse.json();
        if (checkData.records && checkData.records.length > 0) {
            return json(409, {
                success: false,
                duplicate: true,
                code: ticketCode,
                type: ticketType,
                error: "التذكرة مستخدمة مسبقاً"
            });
        }

        // جرّب الحقول الكاملة، ثم الحقول الأساسية إن فشل مخطط الجدول
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
                return json(200, { success: true, code: ticketCode, type: ticketType });
            }

            lastError = await response.json().catch(() => ({}));
            console.error("Airtable Error:", lastError);

            // إن كان الخطأ ليس UNKNOWN_FIELD_NAME، لا داعي للمحاولة بحقول أقل
            const airtableType = lastError?.error?.type || lastError?.error;
            if (airtableType && airtableType !== "UNKNOWN_FIELD_NAME" && airtableType !== "INVALID_VALUE_FOR_COLUMN") {
                return json(response.status, {
                    error: "فشل الإرسال إلى Airtable",
                    details: lastError?.error || lastError
                });
            }
        }

        return json(500, {
            error: "فشل الإرسال إلى Airtable",
            details: lastError?.error || lastError
        });
    } catch (error) {
        console.error("Error processing request:", error);
        return json(500, { error: "حدث خطأ داخلي", details: String(error && error.message || error) });
    }
};

// دالة Netlify للتعامل مع Airtable بأمان وتوجيه البيانات للجدول الصحيح
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    
    try {
        const data = JSON.parse(event.body);
        const ticketCode = String(data.ticketCode || "").trim();
        const ticketType = data.ticketType; // "Citadel" أو "Museum"

        if (!ticketCode || !ticketType) {
            return { statusCode: 400, body: JSON.stringify({ error: "بيانات غير مكتملة" }) };
        }

        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
        
        // تحديد اسم الجدول بناءً على الاختيار
        // يجب أن تنشئ جدولين في Airtable بنفس هذه الأسماء
        const tableName = ticketType === 'Citadel' ? "Citadel" : "Museum";

        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
            console.error("Missing Airtable Environment Variables");
            return { statusCode: 500, body: JSON.stringify({ error: "إعدادات Airtable غير مكتملة" }) };
        }

        const headers = {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        };

        const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        // حماية من المسح المكرر: التحقق أولاً إن كان الكود مسجلاً مسبقاً
        const escapedCode = ticketCode.replace(/'/g, "\\'");
        const filter = encodeURIComponent(`{Ticket Code}='${escapedCode}'`);
        const checkResponse = await fetch(`${baseUrl}?filterByFormula=${filter}&maxRecords=1`, {
            method: 'GET',
            headers
        });

        if (!checkResponse.ok) {
            const errorData = await checkResponse.json().catch(() => ({}));
            console.error("Airtable Check Error:", errorData);
            return { statusCode: checkResponse.status, body: JSON.stringify({ error: "فشل التحقق من التذكرة" }) };
        }

        const checkData = await checkResponse.json();
        if (checkData.records && checkData.records.length > 0) {
            return {
                statusCode: 409,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    success: false,
                    duplicate: true,
                    code: ticketCode,
                    type: ticketType,
                    error: "التذكرة مستخدمة مسبقاً"
                })
            };
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                records: [
                    {
                        fields: {
                            "Ticket Code": ticketCode,
                            "Status": "Scanned",
                            "Scan Time": new Date().toISOString()
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Airtable Error:", errorData);
            return { statusCode: response.status, body: JSON.stringify({ error: "فشل الإرسال إلى Airtable" }) };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ success: true, code: ticketCode, type: ticketType })
        };

    } catch (error) {
        console.error("Error processing request:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "حدث خطأ داخلي" }) };
    }
};

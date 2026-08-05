// دالة Netlify للتعامل مع Airtable بأمان وتوجيه البيانات للجدول الصحيح
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    
    try {
        const data = JSON.parse(event.body);
        const ticketCode = data.ticketCode;
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

        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
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

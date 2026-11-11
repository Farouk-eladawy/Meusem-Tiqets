// تسجيل مسح التذكرة في Baserow مع الإبقاء على أسماء الأعمدة.
// أرقام الجداول تختلف عن Airtable وتُضبط عبر متغيرات البيئة.

const TABLE_ENV = {
    Citadel: "BASEROW_TABLE_CITADEL",
    Museum: "BASEROW_TABLE_MUSEUM",
    Pyramids: "BASEROW_TABLE_PYRAMIDS",
    Saqqara: "BASEROW_TABLE_SAQQARA"
};

// أرقام الجداول في Baserow على booking.tourcare.ai
const DEFAULT_TABLES = {
    Citadel: "1257",
    Museum: "1258",
    Pyramids: "1259",
    Saqqara: "1260"
};

const DEFAULT_API_URL = "https://booking.tourcare.ai";

function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
}

function readConfig(env) {
    const apiUrl = trimSlash(env.BASEROW_API_URL || env.BASEROW_URL || DEFAULT_API_URL)
        .replace(/\/api$/i, "");
    const token = String(env.BASEROW_TOKEN || env.BASEROW_API_TOKEN || "").trim();
    const tables = {};

    for (const [ticketType, envName] of Object.entries(TABLE_ENV)) {
        const raw = String(env[envName] || "").trim();
        tables[ticketType] = /^\d+$/.test(raw) ? raw : DEFAULT_TABLES[ticketType];
    }

    return { apiUrl, token, tables };
}

function shouldUseDefaultTable(body) {
    const text = JSON.stringify(body || "");
    return text.includes("ERROR_TABLE_DOES_NOT_EXIST") || text.includes("ERROR_NO_PERMISSION_TO_TABLE");
}

function missingSettings(config, ticketType) {
    const missing = [];
    if (!config.apiUrl) missing.push("BASEROW_API_URL");
    if (!config.token) missing.push("BASEROW_TOKEN");
    if (!config.tables[ticketType]) missing.push(TABLE_ENV[ticketType]);
    return missing;
}

async function readJson(response) {
    return response.json().catch(() => ({}));
}

function isDuplicateRow(results, ticketCode) {
    return (results || []).some((row) => String(row["Ticket Code"] || "").trim() === ticketCode);
}

async function findExistingRow(config, tableId, ticketCode) {
    const headers = {
        Authorization: `Token ${config.token}`,
        "Content-Type": "application/json"
    };

    const filterUrl = new URL(`${config.apiUrl}/api/database/rows/table/${tableId}/`);
    filterUrl.searchParams.set("user_field_names", "true");
    filterUrl.searchParams.set("size", "1");
    filterUrl.searchParams.set("filter__Ticket Code__equal", ticketCode);

    let response = await fetch(filterUrl, { method: "GET", headers });

    if (response.status === 400) {
        const searchUrl = new URL(`${config.apiUrl}/api/database/rows/table/${tableId}/`);
        searchUrl.searchParams.set("user_field_names", "true");
        searchUrl.searchParams.set("size", "100");
        searchUrl.searchParams.set("search", ticketCode);
        response = await fetch(searchUrl, { method: "GET", headers });

        if (!response.ok) {
            return { ok: false, status: response.status, body: await readJson(response) };
        }

        const data = await readJson(response);
        return { ok: true, exists: isDuplicateRow(data.results, ticketCode) };
    }

    if (!response.ok) {
        return { ok: false, status: response.status, body: await readJson(response) };
    }

    const data = await readJson(response);
    return {
        ok: true,
        exists: Array.isArray(data.results) && data.results.length > 0
    };
}

function fieldSets(ticketCode) {
    return [
        {
            "Ticket Code": ticketCode,
            Status: "Scanned",
            "Scan Time": new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
        },
        {
            "Ticket Code": ticketCode,
            Status: "Scanned"
        },
        {
            "Ticket Code": ticketCode
        }
    ];
}

function canRetryWithFewerFields(status, body) {
    if (status !== 400) return false;
    const text = JSON.stringify(body || "").toLowerCase();
    return (
        text.includes("error_request_body_validation") ||
        text.includes("field_does_not_exist") ||
        text.includes("invalid") ||
        text.includes("select option")
    );
}

async function createRow(config, tableId, ticketCode) {
    const headers = {
        Authorization: `Token ${config.token}`,
        "Content-Type": "application/json"
    };
    const url = `${config.apiUrl}/api/database/rows/table/${tableId}/?user_field_names=true`;
    let lastStatus = 500;
    let lastBody = {};

    for (const fields of fieldSets(ticketCode)) {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(fields)
        });

        if (response.ok) return { ok: true };

        lastStatus = response.status;
        lastBody = await readJson(response);
        console.error("Baserow Error:", lastBody);

        if (!canRetryWithFewerFields(lastStatus, lastBody)) {
            return { ok: false, status: lastStatus, body: lastBody };
        }
    }

    return { ok: false, status: lastStatus, body: lastBody };
}

async function submitTicketScan({ ticketCode, ticketType, env = process.env }) {
    const code = String(ticketCode || "").trim();
    const type = ticketType;

    if (!code || !type) {
        return { status: 400, body: { error: "بيانات غير مكتملة" } };
    }

    if (!TABLE_ENV[type]) {
        return { status: 400, body: { error: "نوع التذكرة غير مدعوم" } };
    }

    const config = readConfig(env);
    const missing = missingSettings(config, type);
    if (missing.length) {
        console.error("Missing Baserow settings:", missing.join(", "));
        return {
            status: 500,
            body: {
                error: "إعدادات Baserow غير مكتملة",
                details: missing.join(", ")
            }
        };
    }

    let activeConfig = config;
    let tableId = config.tables[type];
    let existing = await findExistingRow(activeConfig, tableId, code);

    const fallbackId = DEFAULT_TABLES[type];
    const fallbackUrl = DEFAULT_API_URL;
    if (
        !existing.ok &&
        shouldUseDefaultTable(existing.body) &&
        (tableId !== fallbackId || activeConfig.apiUrl !== fallbackUrl)
    ) {
        activeConfig = { ...activeConfig, apiUrl: fallbackUrl };
        tableId = fallbackId;
        existing = await findExistingRow(activeConfig, tableId, code);
    }

    if (!existing.ok) {
        console.error("Baserow Check Error:", existing.body);
        const baserowError = existing.body.error || existing.body.detail || existing.body;
        const details = shouldUseDefaultTable(existing.body)
            ? `رقم الجدول ${tableId} غير متاح`
            : baserowError;
        return {
            status: existing.status || 502,
            body: {
                error: "فشل التحقق من التذكرة",
                details
            }
        };
    }

    if (existing.exists) {
        return {
            status: 409,
            body: {
                success: false,
                duplicate: true,
                code,
                type,
                error: "التذكرة مستخدمة مسبقاً"
            }
        };
    }

    const created = await createRow(activeConfig, tableId, code);
    if (!created.ok) {
        return {
            status: created.status || 500,
            body: {
                error: "فشل الإرسال إلى Baserow",
                details: (created.body && (created.body.error || created.body.detail)) || created.body
            }
        };
    }

    return {
        status: 200,
        body: { success: true, code, type }
    };
}

module.exports = { submitTicketScan };

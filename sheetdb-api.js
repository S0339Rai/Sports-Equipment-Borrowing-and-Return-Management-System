ห
/**
 * sheetdb-api.js
 * -----------------------------------------------------------------
 * ไลบรารีเชื่อมต่อกับ Google Sheet ผ่าน SheetDB (https://sheetdb.io)
 * ไฟล์นี้มีแค่ "ฟังก์ชันเรียก API" เท่านั้น ไม่ยุ่งกับ DOM ของหน้าเว็บ
 * ตรรกะการแสดงผล/ฟอร์มทั้งหมดอยู่ใน script.js
 *
 * ต้องใส่ <script src="sheetdb-api.js"></script> ไว้ "ก่อน" <script src="script.js">
 * ในทุกหน้า HTML ที่ต้องใช้ข้อมูลจริงจาก Google Sheet
 * -----------------------------------------------------------------
 */

const API_ID = "stqpjvqtdspkm";
const BASE_URL = `https://sheetdb.io/api/v1/${API_ID}`;

const SHEETS = {
    MEMBERS: "สมาชิก",
    EQUIPMENT: "อุปกรณ์กีฬา",
    BOOKINGS: "การจอง",
};

function sheetUrl(sheetName, extraQuery = "") {
    return `${BASE_URL}?sheet=${encodeURIComponent(sheetName)}${extraQuery}`;
}

async function request(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`SheetDB error ${res.status}: ${text}`);
    }
    return res.json();
}

/* ---------------- สมาชิก (Members) ---------------- */

async function registerMember(member) {
    return request(sheetUrl(SHEETS.MEMBERS), {
        method: "POST",
        body: JSON.stringify({ data: member }),
    });
}

/** สร้างรหัสสมาชิกใหม่ที่ไม่ซ้ำกัน ใช้ตอนสมัครสมาชิก */
function generateMemberId() {
    return "M" + Date.now();
}

async function getMemberById(memberId) {
    const url = sheetUrl(SHEETS.MEMBERS, `&รหัสสมาชิก=${encodeURIComponent(memberId)}`);
    const rows = await request(url);
    return rows[0] || null;
}

async function getMemberByEmail(email) {
    const url = sheetUrl(SHEETS.MEMBERS, `&อีเมล=${encodeURIComponent(email)}`);
    const rows = await request(url);
    return rows[0] || null;
}

async function updateMember(memberId, updates) {
    const url = `${BASE_URL}/รหัสสมาชิก/${encodeURIComponent(memberId)}?sheet=${encodeURIComponent(SHEETS.MEMBERS)}`;
    return request(url, {
        method: "PATCH",
        body: JSON.stringify({ data: updates }),
    });
}

/**
 * บันทึกข้อมูลสมาชิก: ถ้ามีแถวของ memberId นี้อยู่แล้วจะ "แก้ไข"
 * ถ้ายังไม่มี (เช่นยังไม่เคยสมัคร หรือแถวตัวอย่างถูกลบไปแล้ว) จะ "สร้างสมาชิกใหม่" ให้อัตโนมัติ
 */
async function upsertMember(memberId, updates) {
    try {
        return await updateMember(memberId, updates);
    } catch (err) {
        if (String(err.message).includes("404")) {
            return await registerMember({
                รหัสสมาชิก: memberId,
                วันที่สมัครสมาชิก: new Date().toISOString().slice(0, 10),
                สถานะบัญชี: "ใช้งาน",
                ...updates,
            });
        }
        throw err;
    }
}

/* ---------------- อุปกรณ์กีฬา (Equipment) ---------------- */

async function getAllEquipment() {
    return request(sheetUrl(SHEETS.EQUIPMENT));
}

async function getAvailableEquipment() {
    const all = await getAllEquipment();
    return all.filter(
        (item) => item.สถานะอุปกรณ์ === "พร้อมใช้งาน" && Number(item.จำนวนคงเหลือ) > 0
    );
}

/* ---------------- การจอง (Bookings) ---------------- */

async function createBooking(booking) {
    return request(sheetUrl(SHEETS.BOOKINGS), {
        method: "POST",
        body: JSON.stringify({ data: booking }),
    });
}

async function getBookingsByMember(memberId) {
    const url = sheetUrl(SHEETS.BOOKINGS, `&รหัสสมาชิก=${encodeURIComponent(memberId)}`);
    return request(url);
}

async function updateBookingStatus(bookingId, newStatus, extra = {}) {
    const url = `${BASE_URL}/รหัสการจอง/${encodeURIComponent(bookingId)}?sheet=${encodeURIComponent(SHEETS.BOOKINGS)}`;
    return request(url, {
        method: "PATCH",
        body: JSON.stringify({ data: { สถานะ: newStatus, ...extra } }),
    });
}

async function deleteBooking(bookingId) {
    const url = `${BASE_URL}/รหัสการจอง/${encodeURIComponent(bookingId)}?sheet=${encodeURIComponent(SHEETS.BOOKINGS)}`;
    return request(url, { method: "DELETE" });
}
/**
 * sheetdb-api.js (ฉบับตัดชีตสมาชิกออกแล้ว)
 */

const API_ID = "4hbx3n1enps0t";
const BASE_URL = `https://sheetdb.io/api/v1/${API_ID}`;

const SHEETS = {
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

/* ---------------- อุปกรณ์กีฬา (Equipment) ---------------- */

async function getAllEquipment() {
    return request(sheetUrl(SHEETS.EQUIPMENT));
}

async function getAvailableEquipment() {
    const all = await getAllEquipment();
    return all.filter(
        (item) => (item.สถานะอุปกรณ์ || item.สถานะ) === "พร้อมใช้งาน" &&
        Number(item.จำนวนคงเหลือ) > 0
    );
}

async function changeEquipmentQuantity(equipmentId, change) {
    const equipment = (await getAllEquipment()).find(
        (item) => String(item.รหัสอุปกรณ์) === String(equipmentId)
    );

    if (!equipment) {
        throw new Error(`ไม่พบอุปกรณ์รหัส ${equipmentId}`);
    }

    const currentQuantity = Number(equipment.จำนวนคงเหลือ);
    if (!Number.isFinite(currentQuantity)) {
        throw new Error(`จำนวนคงเหลือของอุปกรณ์รหัส ${equipmentId} ไม่ถูกต้อง`);
    }

    const newQuantity = currentQuantity + change;
    if (newQuantity < 0) {
        throw new Error("อุปกรณ์คงเหลือไม่เพียงพอ");
    }

    const currentBorrowedQuantity = Number(equipment.จำนวนที่ถูกยืมอยู่ || 0);
    if (!Number.isFinite(currentBorrowedQuantity)) {
        throw new Error(`จำนวนที่ถูกยืมของอุปกรณ์รหัส ${equipmentId} ไม่ถูกต้อง`);
    }

    const newBorrowedQuantity = Math.max(0, currentBorrowedQuantity - change);
    const url = `${BASE_URL}/รหัสอุปกรณ์/${encodeURIComponent(equipmentId)}?sheet=${encodeURIComponent(SHEETS.EQUIPMENT)}`;
    await request(url, {
        method: "PATCH",
        body: JSON.stringify({
            data: {
                จำนวนคงเหลือ: newQuantity,
                จำนวนที่ถูกยืมอยู่: newBorrowedQuantity,
            },
        }),
    });
}

/* ---------------- การจอง/ยืม (Bookings) ---------------- */

async function createBooking(booking) {
    return request(sheetUrl(SHEETS.BOOKINGS), {
        method: "POST",
        body: JSON.stringify({ data: booking }),
    });
}

async function getBookingsByMember(studentId) {
    const url = sheetUrl(SHEETS.BOOKINGS, `&รหัสประจำตัวนักเรียน=${encodeURIComponent(studentId)}`);
    return request(url);
}

async function updateBookingStatus(bookingId, newStatus, extra = {}) {
    const url = `${BASE_URL}/รหัสการยืม/${encodeURIComponent(bookingId)}?sheet=${encodeURIComponent(SHEETS.BOOKINGS)}`;
    return request(url, {
        method: "PATCH",
        body: JSON.stringify({ data: { สถานะการยืม: newStatus, ...extra } }),
    });
}

async function deleteBooking(bookingId) {
    const url = `${BASE_URL}/รหัสการยืม/${encodeURIComponent(bookingId)}?sheet=${encodeURIComponent(SHEETS.BOOKINGS)}`;
    return request(url, { method: "DELETE" });
}
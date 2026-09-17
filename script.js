/**
 * script.js
 * -----------------------------------------------------------------
 * ตรรกะของระบบยืม-คืนอุปกรณ์กีฬา
 * (ใช้รหัสประจำตัวนักเรียนเป็นคีย์หลัก โดยไม่ต้องสมัครสมาชิก)
 * -----------------------------------------------------------------
 */

/* ---------------- เมนูโปรไฟล์ / Dropdown ---------------- */
const profile = document.getElementById('profileToggle');
if (profile) {
    profile.addEventListener('click', (e) => {
        profile.classList.toggle('open');
        e.stopPropagation();
    });
    document.addEventListener('click', () => {
        profile.classList.remove('open');
    });
}

/* ---------------- แท็บหมวดหมู่ (equipment.html) ---------------- */
const tabs = document.querySelectorAll('.tab');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

/* ---------------- ตัวช่วยเรื่องวันที่ ---------------- */
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function formatThaiDateShort(isoDate) {
    if (!isoDate) return '-';
    if (String(isoDate).includes('/')) return isoDate;

    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate || '-';
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function daysInMonth(monthNum, yearAD) {
    return new Date(yearAD, monthNum, 0).getDate();
}

/** แปลงข้อความ วว/ดด/ปปปป (พ.ศ.) -> yyyy-mm-dd (ค.ศ.) */
function parseThaiDateInput(text) {
    if (!text) return null;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearBE = Number(match[3]);
    const yearAD = yearBE - 543;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > daysInMonth(month, yearAD)) return null;
    if (yearBE < 2400 || yearBE > 2700) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${yearAD}-${pad(month)}-${pad(day)}`;
}

function statusBadgeClass(status) {
    const map = {
        'กำลังยืม': 'badge-active',
        'ยกเลิก': 'badge-cancelled',
        'คืนแล้ว': 'badge-returned',
        'เกินกำหนดคืน': 'badge-notreturned',
    };
    return map[status] || 'badge-active';
}

/* ---------------- ฟังก์ชันส่วนกลางสำหรับการคืนอุปกรณ์ ---------------- */
async function returnEquipment(bookingId, equipmentId) {
    if (!equipmentId) {
        throw new Error('ไม่พบรหัสอุปกรณ์ของรายการยืมนี้');
    }

    // 1. เพิ่มจำนวนอุปกรณ์คงเหลือคืนกลับไป
    await changeEquipmentQuantity(equipmentId, 1);
    
    // 2. อัปเดตสถานะการยืมเป็น "คืนแล้ว"
    try {
        await updateBookingStatus(bookingId, 'คืนแล้ว', { วันที่คืนจริง: todayISO() });
    } catch (err) {
        // หากอัปเดตสถานะไม่สำเร็จ ให้ Rollback จำนวนอุปกรณ์กลับ
        try {
            await changeEquipmentQuantity(equipmentId, -1);
        } catch (rollbackErr) {
            throw new Error(`${err.message} และไม่สามารถคืนค่าจำนวนคงเหลือได้: ${rollbackErr.message}`);
        }
        throw err;
    }
}

/* =====================================================================
   หน้า "รายการอุปกรณ์ทั้งหมด" (equipment.html)
===================================================================== */
const equipmentGrid = document.getElementById('equipmentGrid');
if (equipmentGrid) {
    (async function initEquipmentPage() {
        try {
            const list = await getAllEquipment();
            renderEquipmentGrid(list);
        } catch (err) {
            equipmentGrid.innerHTML = `<p class="empty-state">โหลดข้อมูลอุปกรณ์ไม่สำเร็จ: ${err.message}</p>`;
        }
    })();

    function renderEquipmentGrid(list) {
        if (!list || !list.length) {
            equipmentGrid.innerHTML = `<p class="empty-state">ยังไม่มีรายการอุปกรณ์</p>`;
            return;
        }
        equipmentGrid.innerHTML = list.map(item => {
            const imageFile = item['URL รูปภาพ'];
            const imageSrc = imageFile ? `images/${encodeURIComponent(imageFile)}` : 'images/no-image.svg';
            const equipName = item['ชื่ออุปกรณ์กีฬา'] || item['ชื่ออุปกรณ์'] || '-';
            const equipId = item['รหัสอุปกรณ์'] || '';

            return `
              <div class="equip-card">
                <img class="equip-img" src="${imageSrc}" alt="${equipName}">
                <p class="equip-name">${equipName}</p>
                <p class="equip-meta">พร้อมให้ยืม ${item.จำนวนคงเหลือ || 0} / ${item.จำนวนทั้งหมด || 0}</p>
                <button class="btn-borrow" data-id="${equipId}">ยืมเลย</button>
              </div>
            `;
        }).join('');

        equipmentGrid.querySelectorAll('.equip-img').forEach(image => {
            image.addEventListener('error', () => { image.src = 'images/no-image.svg'; }, { once: true });
        });

        equipmentGrid.querySelectorAll('.btn-borrow').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `booking.html?equip=${encodeURIComponent(btn.dataset.id)}`;
            });
        });
    }
}

/* =====================================================================
   หน้า "จองอุปกรณ์" (booking.html)
===================================================================== */
const bookingForm = document.getElementById('bookingForm');
const bookingListEl = document.getElementById('bookingList');
const bkEquipmentSelect = document.getElementById('bk-equipment');

if (bookingForm && bookingListEl) {
    let equipmentCache = [];

    (async function initBookingPage() {
        await populateEquipmentSelect();

        const savedStudentId = localStorage.getItem('lastStudentId');
        if (savedStudentId && document.getElementById('bk-studentid')) {
            document.getElementById('bk-studentid').value = savedStudentId;
        }

        await renderBookingList();
    })();

    async function populateEquipmentSelect() {
        try {
            equipmentCache = await getAllEquipment();
        } catch (err) {
            if (bkEquipmentSelect) bkEquipmentSelect.innerHTML = `<option value="">โหลดรายการอุปกรณ์ไม่สำเร็จ</option>`;
            return;
        }

        const preselect = new URLSearchParams(window.location.search).get('equip') || '';

        if (bkEquipmentSelect) {
            bkEquipmentSelect.innerHTML = '<option value="">เลือกอุปกรณ์</option>' +
                equipmentCache.map(item => {
                    const qty = Number(item.จำนวนคงเหลือ || 0);
                    const status = item.สถานะ || item.สถานะอุปกรณ์;
                    const unavailable = status !== 'พร้อมใช้งาน' || qty <= 0;
                    const name = item['ชื่ออุปกรณ์กีฬา'] || item['ชื่ออุปกรณ์'];
                    const id = item['รหัสอุปกรณ์'];
                    const label = unavailable ? `${name} (ของหมด)` : `${name} (พร้อมให้ยืม ${qty})`;
                    return `<option value="${id}" ${unavailable ? 'disabled' : ''}>${label}</option>`;
                }).join('');

            if (preselect) bkEquipmentSelect.value = preselect;
        }
    }

    async function renderBookingList() {
        bookingListEl.innerHTML = `<p class="empty-state">กำลังโหลด...</p>`;
        let bookings = [];
        try {
            bookings = await request(sheetUrl(SHEETS.BOOKINGS));
        } catch (err) {
            bookingListEl.innerHTML = `<p class="empty-state">โหลดรายการยืมไม่สำเร็จ: ${err.message}</p>`;
            return;
        }

        const activeBookings = (bookings || [])
            .filter(b => (b['สถานะการยืม'] || b.สถานะ) === 'กำลังยืม')
            .slice(-5)
            .reverse();

        if (!activeBookings.length) {
            bookingListEl.innerHTML = `<p class="empty-state">ยังไม่มีรายการที่ยืมอยู่ กรอกฟอร์มด้านซ้ายเพื่อยืมอุปกรณ์</p>`;
            return;
        }

        bookingListEl.innerHTML = activeBookings.map(b => {
            const equipName = b['ชื่ออุปกรณ์กีฬา'] || b.ชื่ออุปกรณ์ || equipmentName(b.รหัสอุปกรณ์);
            const bookingId = b['รหัสการยืม'] || b.รหัสการจอง;
            const equipId = b['รหัสอุปกรณ์'] || '';
            const status = b['สถานะการยืม'] || b.สถานะ || 'กำลังยืม';
            const studentIdVal = b['รหัสประจำตัวนักเรียน'] || b['รหัสสมาชิก/รหัสประจำตัวนักเรียน'] || '-';
            const studentInfo = b['ชื่อ-นามสกุล'] ? `${b['ชื่อ-นามสกุล']} (${b['ชั้น/ห้อง'] || '-'})` : studentIdVal;

            return `
        <div class="booking-item" data-id="${bookingId}">
          <div class="booking-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <div class="booking-info">
            <p class="b-name">${equipName}</p>
            <p class="b-time">ผู้ยืม: ${studentInfo}</p>
            <p class="b-time">${formatThaiDateShort(b['วันที่ยืม'] || b.วันที่ต้องการยืม)} เวลา ${b.เวลานัดรับ || b.เวลาที่จอง || ''}</p>
          </div>
          <div class="booking-item-status">
            <span class="badge ${statusBadgeClass(status)}">${status}</span>
            <button class="btn-mini" data-action="return" data-id="${bookingId}" data-equipment-id="${equipId}">คืนอุปกรณ์</button>
          </div>
        </div>
      `;
        }).join('');

        bookingListEl.querySelectorAll('[data-action="return"]').forEach(btn => {
            btn.addEventListener('click', async() => {
                if (!confirm('ยืนยันว่าคืนอุปกรณ์ชิ้นนี้แล้วใช่หรือไม่?')) return;
                btn.disabled = true;
                try {
                    await returnEquipment(btn.dataset.id, btn.dataset.equipmentId);
                    await renderBookingList();
                    await populateEquipmentSelect();
                } catch (err) {
                    alert('เกิดข้อผิดพลาด: ' + err.message);
                    btn.disabled = false;
                }
            });
        });
    }

    function equipmentName(equipId) {
        const item = equipmentCache.find(e => e.รหัสอุปกรณ์ === equipId);
        return item ? (item['ชื่ออุปกรณ์กีฬา'] || item['ชื่ออุปกรณ์']) : equipId;
    }

    bookingForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const equipmentId = bkEquipmentSelect.value;
        const firstName = document.getElementById('bk-firstname').value.trim();
        const lastName = document.getElementById('bk-lastname').value.trim();
        const studentId = document.getElementById('bk-studentid').value.trim();
        const className = document.getElementById('bk-class').value.trim();
        const dateText = document.getElementById('bk-date').value;
        const time = document.getElementById('bk-time').value;
        const purpose = document.getElementById('bk-purpose').value.trim();
        const note = document.getElementById('bk-note').value.trim();

        if (!equipmentId || !studentId || !dateText || !time || !purpose) {
            alert('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน');
            return;
        }

        const date = parseThaiDateInput(dateText);
        if (!date) {
            alert('กรุณากรอกวันที่ให้ถูกต้องในรูปแบบ วว/ดด/ปปปป (พ.ศ.) เช่น 05/03/2569');
            return;
        }

        localStorage.setItem('lastStudentId', studentId);

        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            await changeEquipmentQuantity(equipmentId, -1);
            try {
                await createBooking({
                    "รหัสการยืม": 'BK' + Date.now(),
                    "รหัสประจำตัวนักเรียน": studentId,
                    "ชื่อ-นามสกุล": `${firstName} ${lastName}`.trim(),
                    "ชั้น/ห้อง": className,
                    "รหัสอุปกรณ์": equipmentId,
                    "ชื่ออุปกรณ์กีฬา": equipmentName(equipmentId),
                    "จำนวนที่ยืม": 1,
                    "วันที่ยืม": dateText,
                    "เวลานัดรับ": time,
                    "วันทดลองการยืม": dateText,
                    "กำหนดคืน": addDays(date, 2),
                    "วัตถุประสงค์": purpose,
                    "หมายเหตุ": note,
                    "สถานะการยืม": 'กำลังยืม',
                });
            } catch (err) {
                try {
                    await changeEquipmentQuantity(equipmentId, 1);
                } catch (rollbackErr) {
                    throw new Error(`${err.message} และไม่สามารถคืนค่าจำนวนคงเหลือได้: ${rollbackErr.message}`);
                }
                throw err;
            }

            bookingForm.reset();
            if (document.getElementById('bk-studentid')) {
                document.getElementById('bk-studentid').value = studentId;
            }
            await populateEquipmentSelect();
            await renderBookingList();

            const successMsg = document.getElementById('bookingSuccessMsg');
            if (successMsg) {
                successMsg.classList.add('show');
                setTimeout(() => successMsg.classList.remove('show'), 3000);
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    const clearBtn = document.getElementById('bk-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => bookingForm.reset());
}

/* =====================================================================
   หน้า "ประวัติการยืม-คืน" (history.html)
===================================================================== */
const historyTableBody = document.getElementById('historyTableBody');
const historyPagination = document.getElementById('historyPagination');

if (historyTableBody && historyPagination) {
    const PAGE_SIZE = 5;
    let currentPage = 1;
    let allBookings = [];

    (async function initHistoryPage() {
        await loadAndRender(1);
    })();

    async function loadAndRender(page) {
        historyTableBody.innerHTML = `<tr><td colspan="10" class="empty-state">กำลังโหลด...</td></tr>`;
        try {
            allBookings = await request(sheetUrl(SHEETS.BOOKINGS));
        } catch (err) {
            historyTableBody.innerHTML = `<tr><td colspan="10" class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${err.message}</td></tr>`;
            return;
        }
        renderHistoryPage(page);
    }

    function historyStatusBadge(b) {
        const status = b['สถานะการยืม'] || b.สถานะ;
        if (status === 'ยกเลิก') return '<span class="badge badge-cancelled">ยกเลิก</span>';
        if (status === 'คืนแล้ว') return '<span class="badge badge-returned">คืนแล้ว</span>';
        if (status === 'กำลังยืม') return '<span class="badge badge-active">กำลังยืม</span>';
        return `<span class="badge ${statusBadgeClass(status)}">${status || 'กำลังยืม'}</span>`;
    }

    function renderHistoryPage(page) {
        if (!allBookings || !allBookings.length) {
            historyTableBody.innerHTML = `<tr><td colspan="10" class="empty-state">ยังไม่มีประวัติการยืม-คืน</td></tr>`;
            historyPagination.innerHTML = '';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(allBookings.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(1, page), totalPages);
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = allBookings.slice(start, start + PAGE_SIZE);

        historyTableBody.innerHTML = pageItems.map((b, i) => {
            const status = b['สถานะการยืม'] || b.สถานะ;
            const canReturn = status === 'กำลังยืม';
            const bookingId = b['รหัสการยืม'] || b.รหัสการจอง;
            const equipId = b['รหัสอุปกรณ์'] || '';
            const studentId = b['รหัสประจำตัวนักเรียน'] || b['รหัสสมาชิก/รหัสประจำตัวนักเรียน'] || '-';
            const qty = b['จำนวนที่ยืม'] || '1';
            const borrowDate = b['วันทดลองการยืม'] || b['วันที่ยืม'] || b['วันที่ต้องการยืม'] || '-';

            return `
        <tr>
          <td>${start + i + 1}</td>
          <td>${b['ชื่ออุปกรณ์กีฬา'] || b.ชื่ออุปกรณ์ || b.รหัสอุปกรณ์}</td>
          <td>${qty}</td>
          <td>${studentId}</td>
          <td>${b['ชื่อ-นามสกุล'] || b.ชื่อผู้จอง || '-'}</td>
          <td>${formatThaiDateShort(borrowDate)}</td>
          <td>${formatThaiDateShort(b['กำหนดคืน'])}</td>
          <td>${b['วันที่คืนจริง'] ? formatThaiDateShort(b['วันที่คืนจริง']) : '-'}</td>
          <td>${historyStatusBadge(b)}</td>
          <td>${canReturn ? `<button class="btn-mini" data-id="${bookingId}" data-equipment-id="${equipId}">คืนอุปกรณ์</button>` : ''}</td>
        </tr>
      `;
        }).join('');

        historyTableBody.querySelectorAll('.btn-mini').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    await returnEquipment(btn.dataset.id, btn.dataset.equipmentId);
                    await loadAndRender(currentPage);
                } catch (err) {
                    alert('เกิดข้อผิดพลาด: ' + err.message);
                    btn.disabled = false;
                }
            });
        });

        const pageButtons = [];
        pageButtons.push(`<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`);
        for (let p = 1; p <= totalPages; p++) {
            pageButtons.push(`<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`);
        }
        pageButtons.push(`<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`);
        historyPagination.innerHTML = pageButtons.join('');

        historyPagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => renderHistoryPage(Number(btn.dataset.page)));
        });
    }
}
/**
 * script.js
 * -----------------------------------------------------------------
 * ตรรกะของแต่ละหน้า — ดึง/บันทึกข้อมูลจริงผ่านฟังก์ชันใน sheetdb-api.js
 * (ต้องโหลด sheetdb-api.js ก่อนไฟล์นี้เสมอ)
 * -----------------------------------------------------------------
 */

/* CURRENT_MEMBER_ID มาจาก auth.js (อ่านจาก localStorage ของเบราว์เซอร์นี้)
   ต้องโหลด auth.js ก่อนไฟล์นี้เสมอในทุกหน้า */

/* ---------------- เมนูโปรไฟล์ (ทุกหน้า) ---------------- */
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
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateLong(isoDate) {
    if (!isoDate) return '-';
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function daysInMonth(monthNum, yearAD) {
    return new Date(yearAD, monthNum, 0).getDate();
}
/** แปลงข้อความ วว/ดด/ปปปป (พ.ศ.) -> yyyy-mm-dd (ค.ศ.) */
function parseThaiDateInput(text) {
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
        'รออนุมัติ': 'badge-pending',
        'อนุมัติแล้ว': 'badge-pending',
        'กำลังยืม': 'badge-active',
        'ยกเลิก': 'badge-cancelled',
        'คืนแล้ว': 'badge-returned',
        'เกินกำหนดคืน': 'badge-notreturned',
    };
    return map[status] || 'badge-pending';
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
        if (!list.length) {
            equipmentGrid.innerHTML = `<p class="empty-state">ยังไม่มีรายการอุปกรณ์</p>`;
            return;
        }
        equipmentGrid.innerHTML = list.map(item => `
      <div class="equip-card">
        <div class="equip-img-placeholder">ตรงนี้คือช่องใส่รูป</div>
        <p class="equip-name">${item.ชื่ออุปกรณ์}</p>
        <p class="equip-meta">พร้อมให้ยืม ${item.จำนวนคงเหลือ} / ${item.จำนวนทั้งหมด}</p>
        <button class="btn-borrow" data-id="${item.รหัสอุปกรณ์}">ยืมเลย</button>
      </div>
    `).join('');

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
    let memberCache = null;

    (async function initBookingPage() {
        await populateEquipmentSelect();
        await loadMemberInfo();
        await renderBookingList();
    })();

    async function loadMemberInfo() {
        try {
            memberCache = await getMemberById(CURRENT_MEMBER_ID);
        } catch (err) {
            console.error('โหลดข้อมูลสมาชิกไม่สำเร็จ:', err);
        }
    }

    function currentMemberName() {
        if (!memberCache) return '';
        return `${memberCache.คำนำหน้า || ''}${memberCache.ชื่อ || ''} ${memberCache.นามสกุล || ''}`.trim();
    }

    async function populateEquipmentSelect() {
        try {
            equipmentCache = await getAllEquipment();
        } catch (err) {
            bkEquipmentSelect.innerHTML = `<option value="">โหลดรายการอุปกรณ์ไม่สำเร็จ</option>`;
            return;
        }

        const preselect = new URLSearchParams(window.location.search).get('equip') || '';

        bkEquipmentSelect.innerHTML = '<option value="">เลือกอุปกรณ์</option>' +
            equipmentCache.map(item => {
                const qty = Number(item.จำนวนคงเหลือ);
                const unavailable = item.สถานะอุปกรณ์ !== 'พร้อมใช้งาน' || qty <= 0;
                const label = unavailable ?
                    `${item.ชื่ออุปกรณ์} (ของหมด)` :
                    `${item.ชื่ออุปกรณ์} (พร้อมให้ยืม ${qty})`;
                return `<option value="${item.รหัสอุปกรณ์}" ${unavailable ? 'disabled' : ''}>${label}</option>`;
            }).join('');

        if (preselect) bkEquipmentSelect.value = preselect;
    }

    async function renderBookingList() {
        bookingListEl.innerHTML = `<p class="empty-state">กำลังโหลด...</p>`;
        let bookings;
        try {
            bookings = await getBookingsByMember(CURRENT_MEMBER_ID);
        } catch (err) {
            bookingListEl.innerHTML = `<p class="empty-state">โหลดรายการจองไม่สำเร็จ: ${err.message}</p>`;
            return;
        }

        const active = bookings.filter(b => b.สถานะ === 'กำลังยืม' || b.สถานะ === 'รออนุมัติ');

        if (!active.length) {
            bookingListEl.innerHTML = `<p class="empty-state">ยังไม่มีรายการที่ยืมอยู่ กรอกฟอร์มด้านซ้ายเพื่อเริ่มจองอุปกรณ์</p>`;
            return;
        }

        bookingListEl.innerHTML = active.map(b => {
                    const equipName = b.ชื่ออุปกรณ์ || equipmentName(b.รหัสอุปกรณ์);
                    const canReturn = b.สถานะ === 'กำลังยืม';
                    return `
        <div class="booking-item" data-id="${b.รหัสการจอง}">
          <div class="booking-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <div class="booking-info">
            <p class="b-name">${equipName}</p>
            <p class="b-time">${formatThaiDateShort(b.วันที่ต้องการยืม)} เวลา ${b.เวลาที่จอง || ''}</p>
          </div>
          <div class="booking-item-status">
            <span class="badge ${statusBadgeClass(b.สถานะ)}">${b.สถานะ}</span>
            ${canReturn ? `<button class="btn-mini" data-action="return" data-id="${b.รหัสการจอง}">คืนอุปกรณ์</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    bookingListEl.querySelectorAll('[data-action="return"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('ยืนยันว่าคืนอุปกรณ์ชิ้นนี้แล้วใช่หรือไม่?')) return;
        btn.disabled = true;
        try {
          await updateBookingStatus(btn.dataset.id, 'คืนแล้ว', { วันที่คืนจริง: todayISO() });
          window.location.href = 'history.html';
        } catch (err) {
          alert('เกิดข้อผิดพลาด: ' + err.message);
          btn.disabled = false;
        }
      });
    });
  }

  function equipmentName(equipId) {
    const item = equipmentCache.find(e => e.รหัสอุปกรณ์ === equipId);
    return item ? item.ชื่ออุปกรณ์ : equipId;
  }

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const equipmentId = bkEquipmentSelect.value;
    const dateText = document.getElementById('bk-date').value;
    const time = document.getElementById('bk-time').value;
    const purpose = document.getElementById('bk-purpose').value.trim();
    const note = document.getElementById('bk-note').value.trim();

    if (!equipmentId || !dateText || !time || !purpose) return;

    const date = parseThaiDateInput(dateText);
    if (!date) {
      alert('กรุณากรอกวันที่ให้ถูกต้องในรูปแบบ วว/ดด/ปปปป (พ.ศ.) เช่น 05/03/2569');
      return;
    }

    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await createBooking({
        รหัสการจอง: 'B' + Date.now(),
        รหัสสมาชิก: CURRENT_MEMBER_ID,
        ชื่อผู้จอง: currentMemberName(),
        รหัสอุปกรณ์: equipmentId,
        ชื่ออุปกรณ์: equipmentName(equipmentId),
        จำนวนที่ยืม: 1,
        วันที่จอง: todayISO(),
        เวลาที่จอง: time,
        วันที่ต้องการยืม: date,
        กำหนดคืน: addDays(date, 2),
        วัตถุประสงค์: purpose,
        หมายเหตุ: note,
        สถานะ: 'กำลังยืม',
      });

      bookingForm.reset();
      await populateEquipmentSelect();
      await renderBookingList();

      const successMsg = document.getElementById('bookingSuccessMsg');
      if (successMsg) {
        successMsg.classList.add('show');
        setTimeout(() => successMsg.classList.remove('show'), 3000);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
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
  const PAGE_SIZE = 4;
  let currentPage = 1;
  let allBookings = [];

  (async function initHistoryPage() {
    await loadAndRender(1);
  })();

  async function loadAndRender(page) {
    historyTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">กำลังโหลด...</td></tr>`;
    try {
      allBookings = await getBookingsByMember(CURRENT_MEMBER_ID);
    } catch (err) {
      historyTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${err.message}</td></tr>`;
      return;
    }
    renderHistoryPage(page);
  }

  function historyStatusBadge(b) {
    if (b.สถานะ === 'ยกเลิก') return '<span class="badge badge-cancelled">ยกเลิก</span>';
    if (b.สถานะ === 'คืนแล้ว') return '<span class="badge badge-returned">คืนแล้ว</span>';
    if (b.สถานะ === 'กำลังยืม') return '<span class="badge badge-notreturned">ยังไม่คืน</span>';
    return `<span class="badge ${statusBadgeClass(b.สถานะ)}">${b.สถานะ}</span>`;
  }

  function renderHistoryPage(page) {
    if (!allBookings.length) {
      historyTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">ยังไม่มีประวัติการยืม-คืน</td></tr>`;
      historyPagination.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(allBookings.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allBookings.slice(start, start + PAGE_SIZE);

    historyTableBody.innerHTML = pageItems.map((b, i) => {
      const canReturn = b.สถานะ === 'กำลังยืม';
      return `
        <tr>
          <td>${start + i + 1}</td>
          <td>${b.ชื่ออุปกรณ์ || b.รหัสอุปกรณ์}</td>
          <td>${formatThaiDateShort(b.วันที่ต้องการยืม)}</td>
          <td>${formatThaiDateShort(b.กำหนดคืน)}</td>
          <td>${b.วันที่คืนจริง ? formatThaiDateShort(b.วันที่คืนจริง) : '-'}</td>
          <td>${historyStatusBadge(b)}</td>
          <td>${canReturn ? `<button class="btn-mini" data-id="${b.รหัสการจอง}">คืนอุปกรณ์</button>` : ''}</td>
        </tr>
      `;
    }).join('');

    historyTableBody.querySelectorAll('.btn-mini').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await updateBookingStatus(btn.dataset.id, 'คืนแล้ว', { วันที่คืนจริง: todayISO() });
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

  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (!confirm('ต้องการลบประวัติการยืม-คืนทั้งหมดของคุณออกจาก Google Sheet ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
      clearHistoryBtn.disabled = true;
      try {
        for (const b of allBookings) {
          await deleteBooking(b.รหัสการจอง);
        }
        await loadAndRender(1);
      } catch (err) {
        alert('เกิดข้อผิดพลาดระหว่างลบ: ' + err.message);
      } finally {
        clearHistoryBtn.disabled = false;
      }
    });
  }
}

/* =====================================================================
   หน้า "โปรไฟล์ของฉัน" (profile.html)
===================================================================== */
const valName = document.getElementById('val-name');
if (valName) {
  (async function initProfilePage() {
    try {
      const m = await getMemberById(CURRENT_MEMBER_ID);
      if (!m) return;
      valName.textContent = `${m.คำนำหน้า || ''}${m.ชื่อ || ''} ${m.นามสกุล || ''}`.trim();
      setText('val-studentid', m.รหัสนักเรียน);
      setText('val-class', m.ชั้นเรียน);
      setText('val-email', m.อีเมล);
      setText('val-phone', m.เบอร์โทรศัพท์);
      setText('val-role', m.ตำแหน่ง);
      setText('val-birthday', '-'); // ชีท "สมาชิก" ยังไม่มีคอลัมน์วันเกิด
    } catch (err) {
      console.error('โหลดโปรไฟล์ไม่สำเร็จ:', err);
    }
  })();

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '-';
  }
}

/* =====================================================================
   หน้า "ตั้งค่าบัญชี" (account-settings.html)
===================================================================== */
const studentSettingsForm = document.getElementById('studentSettingsForm');
if (studentSettingsForm) {
  const inputName = document.getElementById('input-name');
  const inputEmail = document.getElementById('input-email');
  const inputPhone = document.getElementById('input-phone');
  const inputStudentId = document.getElementById('input-studentid');
  const inputClass = document.getElementById('input-class');
  const inputRole = document.getElementById('input-role');
  const saveMsg = document.getElementById('saveMsg');
  const cancelBtn = document.getElementById('cancelBtn');

  async function fillFormFromSheet() {
    try {
      const m = await getMemberById(CURRENT_MEMBER_ID);
      if (!m) return;
      inputName.value = `${m.คำนำหน้า || ''}${m.ชื่อ || ''} ${m.นามสกุล || ''}`.trim();
      inputEmail.value = m.อีเมล || '';
      inputPhone.value = m.เบอร์โทรศัพท์ || '';
      inputStudentId.value = m.รหัสนักเรียน || '';
      inputClass.value = m.ชั้นเรียน || '';
      inputRole.value = m.ตำแหน่ง || 'นักเรียน';
    } catch (err) {
      console.error('โหลดข้อมูลไม่สำเร็จ:', err);
    }
  }
  fillFormFromSheet();

  studentSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = studentSettingsForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      // หมายเหตุ: ชีท "สมาชิก" เก็บชื่อ-นามสกุลแยกคอลัมน์กัน ที่นี่จึงบันทึกชื่อเต็มไว้ในคอลัมน์ "ชื่อ" เพื่อความง่าย
      // ถ้าต้องการแยกคำนำหน้า/ชื่อ/นามสกุลให้ถูกต้อง ให้ปรับฟอร์มเพิ่มช่องกรอกแยกภายหลัง
      await upsertMember(CURRENT_MEMBER_ID, {
        ชื่อ: inputName.value.trim(),
        อีเมล: inputEmail.value.trim(),
        เบอร์โทรศัพท์: inputPhone.value.trim(),
        รหัสนักเรียน: inputStudentId.value.trim(),
        ชั้นเรียน: inputClass.value.trim(),
        ตำแหน่ง: inputRole.value,
      });

      saveMsg.classList.add('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => saveMsg.classList.remove('show'), 3000);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      fillFormFromSheet();
      saveMsg.classList.remove('show');
    });
  }
}
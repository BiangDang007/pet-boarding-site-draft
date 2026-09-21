// admin.js — back office logic (admin.html)
(function () {
  'use strict';
  var h = Store.h;
  var LOGIN_KEY = 'zz-admin-logged-in';

  function $(id) { return document.getElementById(id); }
  function makeBtn(label, cls, fn) {
    var b = h('button', { type: 'button', class: cls || 'btn-secondary' }, [label]);
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(e); });
    return b;
  }
  // Strict "0 or positive integer" parser — rejects decimals (12.7),
  // scientific notation (1e5), leading/trailing junk, etc. Returns null
  // (not NaN) for anything that doesn't match, so callers can just check
  // `=== null` instead of NaN-testing.
  function parseStrictNonNegInt(str) {
    str = String(str == null ? '' : str).trim();
    if (!/^\d{1,7}$/.test(str)) return null;
    return parseInt(str, 10);
  }
  function populateSelect(id, items, valueFn, textFn, placeholder) {
    var el = $(id);
    el.replaceChildren();
    if (placeholder) el.appendChild(h('option', { value: '' }, [placeholder]));
    items.forEach(function (item) {
      el.appendChild(h('option', { value: valueFn(item) }, [textFn(item)]));
    });
  }

  // ---------------- login ----------------
  function initLogin() {
    $('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var user = $('loginUser').value.trim();
      var pass = $('loginPass').value;
      var errEl = $('loginError');
      if (user === 'demo' && pass === 'demo1234') {
        errEl.textContent = '';
        try { sessionStorage.setItem(LOGIN_KEY, '1'); } catch (e2) {}
        showApp();
      } else {
        errEl.textContent = '帳號或密碼錯誤，請再試一次。';
      }
    });
    $('logoutBtn').addEventListener('click', function () {
      try { sessionStorage.removeItem(LOGIN_KEY); } catch (e) {}
      $('appShell').hidden = true;
      $('loginScreen').hidden = false;
      $('loginPass').value = '';
    });
  }
  function showApp() {
    $('loginScreen').hidden = true;
    $('appShell').hidden = false;
    showView('bookings');
  }

  // ---------------- nav / view switching ----------------
  var currentView = 'bookings';
  function showView(name) {
    currentView = name;
    document.querySelectorAll('[data-view-section]').forEach(function (sec) {
      sec.hidden = sec.id !== 'view-' + name;
    });
    document.querySelectorAll('#adminNav button[data-view]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    if (name === 'bookings') { renderCalendar(); renderDayList(); }
    else if (name === 'customers') { renderCustomerList(); }
    else if (name === 'fees') { renderFeeList(); }
    else if (name === 'photos') { $('folderDetailView').hidden = true; $('folderListView').hidden = false; renderFolderList(); }
    else if (name === 'plans') { renderPlanList(); }
    else if (name === 'messages') { renderMessageList(); }
    else if (name === 'settings') { renderSettingsForm(); }
  }
  function initNav() {
    document.querySelectorAll('#adminNav button[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { showView(btn.dataset.view); });
    });
    document.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dialog = btn.closest('dialog');
        if (dialog) dialog.close();
      });
    });
    $('resetDemoBtn').addEventListener('click', function () {
      if (!confirm('確定要重置 Demo 資料嗎？所有變更將會消失，恢復成範例資料。')) return;
      Store.resetDemo().then(function () { window.location.reload(); });
    });
  }
  function bindStatusFilterGroup(containerId, onChange) {
    var buttons = document.querySelectorAll('#' + containerId + ' button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        onChange(btn.dataset.status);
      });
    });
  }

  // ---------------- bookings / calendar ----------------
  var calState = { year: 0, month: 0, selectedDate: '', statusFilter: 'all' };
  var editingBookingId = null;
  function isCompactCal() { return window.matchMedia('(max-width: 600px)').matches; }

  function renderCalendar() {
    var y = calState.year, m = calState.month;
    $('calTitle').textContent = y + ' 年 ' + (m + 1) + ' 月';
    var grid = $('calGrid');
    grid.replaceChildren();
    var headRow = h('div', { class: 'cal-row head' });
    ['日', '一', '二', '三', '四', '五', '六'].forEach(function (d) { headRow.appendChild(h('div', { class: 'cal-cell' }, [d])); });
    grid.appendChild(headRow);

    var startOffset = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    var row = null;
    for (var i = 0; i < totalCells; i++) {
      if (i % 7 === 0) { row = h('div', { class: 'cal-row' }); grid.appendChild(row); }
      var dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        row.appendChild(h('div', { class: 'cal-cell other-month' }));
        continue;
      }
      var dateStr = Store.todayISO(new Date(y, m, dayNum));
      var cell = h('div', { class: 'cal-cell' + (dateStr === calState.selectedDate ? ' selected' : '') });
      cell.appendChild(h('span', { class: 'dnum' }, [String(dayNum)]));
      var bookings = Store.bookingsOnDay(dateStr);
      if (calState.statusFilter !== 'all') bookings = bookings.filter(function (b) { return b.status === calState.statusFilter; });
      if (isCompactCal()) {
        // Narrow screens: no room for per-booking chips without forcing
        // horizontal scroll. Show a coloured-dot summary instead; tapping
        // the day cell selects it and the full list appears below.
        if (bookings.length) {
          var statusesPresent = [];
          bookings.forEach(function (b) { if (statusesPresent.indexOf(b.status) === -1) statusesPresent.push(b.status); });
          var dots = h('div', { class: 'cal-dots' });
          statusesPresent.forEach(function (st) { dots.appendChild(h('span', { class: 'cal-dot status-' + st })); });
          dots.appendChild(h('span', { class: 'cal-count' }, [String(bookings.length)]));
          cell.appendChild(dots);
        }
      } else {
        bookings.forEach(function (b) {
          var cust = Store.getCustomers().find(function (c) { return c.id === b.customerId; });
          var chip = h('button', { type: 'button', class: 'chip status-' + b.status }, [cust ? cust.name : '（已刪除客戶）']);
          chip.addEventListener('click', function (e) { e.stopPropagation(); openBookingDialog(b); });
          cell.appendChild(chip);
        });
      }
      (function (ds) {
        cell.addEventListener('click', function () {
          calState.selectedDate = ds;
          renderCalendar(); renderDayList();
        });
      })(dateStr);
      row.appendChild(cell);
    }
  }

  function renderDayList() {
    var host = $('dayList');
    host.replaceChildren();
    var dateStr = calState.selectedDate;
    host.appendChild(h('h3', {}, [Store.formatDateDisplay(dateStr) + ' 的預約']));
    var bookings = Store.bookingsOnDay(dateStr);
    if (calState.statusFilter !== 'all') bookings = bookings.filter(function (b) { return b.status === calState.statusFilter; });
    if (!bookings.length) { host.appendChild(h('p', { class: 'empty-note' }, ['這天還沒有預約'])); return; }
    bookings.forEach(function (b) {
      var cust = Store.getCustomers().find(function (c) { return c.id === b.customerId; });
      var plan = Store.getPlans().find(function (p) { return p.id === b.planId; });
      var row = h('div', { class: 'booking-row' }, [
        h('div', { class: 'b-info' }, [
          h('strong', {}, [cust ? cust.name : '（已刪除客戶）']),
          h('span', {}, [(plan ? plan.name : '（已刪除方案）') + '　' + Store.formatDateDisplay(b.startDate) + ' ~ ' + Store.formatDateDisplay(b.endDate)])
        ]),
        h('span', { class: 'pill status-' + b.status }, [b.status])
      ]);
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () { openBookingDialog(b); });
      host.appendChild(row);
    });
  }

  function openBookingDialog(booking, prefillDate) {
    editingBookingId = booking ? booking.id : null;
    var form = $('bookingForm');
    form.reset();
    $('bookingDialogTitle').textContent = booking ? '編輯預約' : '新增預約';
    populateSelect('bkCustomer', Store.getCustomers(), function (c) { return c.id; }, function (c) { return c.name + '（' + c.petName + '）'; });
    populateSelect('bkPlan', Store.getPlans(), function (p) { return p.id; }, function (p) { return p.name + ' ' + Store.formatPrice(p.price); });
    $('quickAddCustomer').hidden = true;
    $('bkDateError').textContent = '';
    if (booking) {
      $('bkCustomer').value = booking.customerId;
      $('bkPlan').value = booking.planId;
      $('bkStart').value = booking.startDate;
      $('bkEnd').value = booking.endDate;
      $('bkNotes').value = booking.notes;
      $('bkStatus').value = booking.status;
    } else {
      var d = prefillDate || calState.selectedDate || Store.todayISO();
      $('bkStart').value = d;
      $('bkEnd').value = d;
      $('bkStatus').value = '待確認';
    }
    $('bkDelete').hidden = !booking;
    $('bkCreateFee').hidden = !booking;
    $('bookingDialog').showModal();
  }

  function bindBookingForm() {
    $('newBookingBtn').addEventListener('click', function () { openBookingDialog(null, calState.selectedDate); });
    $('qaToggle').addEventListener('click', function () { $('quickAddCustomer').hidden = !$('quickAddCustomer').hidden; });
    $('qaConfirm').addEventListener('click', function () {
      var name = $('qaName').value.trim();
      var phone = $('qaPhone').value.trim();
      if (!name) { Store.toast('請輸入新客戶姓名', 'error'); return; }
      Store.addCustomer({ name: name.slice(0, 100), phone: phone.slice(0, 100) }).then(function (c) {
        populateSelect('bkCustomer', Store.getCustomers(), function (x) { return x.id; }, function (x) { return x.name + '（' + x.petName + '）'; });
        $('bkCustomer').value = c.id;
        $('quickAddCustomer').hidden = true;
        $('qaName').value = ''; $('qaPhone').value = '';
        Store.toast('已新增客戶', 'success');
      });
    });
    $('bookingForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var start = $('bkStart').value, end = $('bkEnd').value;
      $('bkDateError').textContent = '';
      if (!start || !end) { $('bkDateError').textContent = '請選擇入住日與退房日'; return; }
      if (end < start) { $('bkDateError').textContent = '退房日不能早於入住日'; return; }
      if (!$('bkCustomer').value || !$('bkPlan').value) { Store.toast('請選擇客戶與方案', 'error'); return; }
      var payload = {
        customerId: $('bkCustomer').value, planId: $('bkPlan').value,
        startDate: start, endDate: end,
        notes: $('bkNotes').value.slice(0, 300), status: $('bkStatus').value
      };
      var p = editingBookingId ? Store.updateBooking(editingBookingId, payload) : Store.addBooking(payload);
      p.then(function () {
        $('bookingDialog').close();
        renderCalendar(); renderDayList();
        Store.toast('預約已儲存', 'success');
      }).catch(function () {});
    });
    $('bkDelete').addEventListener('click', function () {
      if (!editingBookingId) return;
      if (!confirm('確定要刪除這筆預約嗎？')) return;
      Store.deleteBooking(editingBookingId).then(function () {
        $('bookingDialog').close();
        renderCalendar(); renderDayList();
        Store.toast('已刪除預約', 'success');
      });
    });
    $('bkCreateFee').addEventListener('click', function () {
      if (!editingBookingId) return;
      var bookingId = editingBookingId;
      var booking = Store.getBookings().find(function (b) { return b.id === bookingId; });
      $('bookingDialog').close();
      var defaults = Store.feeDefaultsFromBooking(bookingId);
      showView('fees');
      openFeeDialog(null, { customerId: booking.customerId, bookingId: bookingId, item: defaults.item, price: defaults.price });
    });
    $('calPrev').addEventListener('click', function () {
      calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; }
      renderCalendar();
    });
    $('calNext').addEventListener('click', function () {
      calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    });
    $('calToday').addEventListener('click', function () {
      var t = new Date();
      calState.year = t.getFullYear(); calState.month = t.getMonth(); calState.selectedDate = Store.todayISO();
      renderCalendar(); renderDayList();
    });
    bindStatusFilterGroup('bookingStatusFilter', function (s) {
      calState.statusFilter = s; renderCalendar(); renderDayList();
    });
    var lastCompact = isCompactCal();
    window.addEventListener('resize', function () {
      var nowCompact = isCompactCal();
      if (nowCompact !== lastCompact) {
        lastCompact = nowCompact;
        if (!$('view-bookings').hidden) renderCalendar();
      }
    });
  }

  // ---------------- customers ----------------
  var editingCustomerId = null;

  function renderCustomerList() {
    var q = ($('customerSearch').value || '').trim().toLowerCase();
    var host = $('customerList');
    host.replaceChildren();
    var list = Store.getCustomers().filter(function (c) {
      if (!q) return true;
      return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
        (c.phone || '').toLowerCase().indexOf(q) >= 0 ||
        (c.petName || '').toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) { host.appendChild(h('p', { class: 'empty-note' }, ['沒有符合的客戶'])); return; }
    list.forEach(function (c) {
      var card = h('div', { class: 'data-card' }, [
        h('div', { class: 'card-title' }, [c.name]),
        h('div', { class: 'card-sub' }, [c.phone + '　寵物：' + (c.petName || '—')]),
        h('div', { class: 'card-actions' }, [makeBtn('編輯', 'btn-secondary', function () { openCustomerDialog(c); })])
      ]);
      card.addEventListener('click', function () { openCustomerDetail(c.id); });
      host.appendChild(card);
    });
  }

  function openCustomerDialog(customer) {
    editingCustomerId = customer ? customer.id : null;
    $('customerDialogTitle').textContent = customer ? '編輯客戶' : '新增客戶';
    $('customerForm').reset();
    $('cuName').value = customer ? customer.name : '';
    $('cuPhone').value = customer ? customer.phone : '';
    $('cuPet').value = customer ? customer.petName : '';
    $('cuNotes').value = customer ? customer.notes : '';
    $('cuDelete').hidden = !customer;
    $('customerDialog').showModal();
  }

  function openCustomerDetail(id) {
    var c = Store.getCustomers().find(function (x) { return x.id === id; });
    if (!c) return;
    $('custDetailTitle').textContent = c.name + ' 的詳細資料';
    var info = $('custDetailInfo');
    info.replaceChildren();
    [['電話', c.phone], ['寵物名', c.petName || '—'], ['備註', c.notes || '—']].forEach(function (pair) {
      info.appendChild(h('dt', {}, [pair[0]]));
      info.appendChild(h('dd', {}, [pair[1]]));
    });
    var summary = Store.customerSummary(id);
    var bHost = $('custDetailBookings');
    bHost.replaceChildren();
    if (!summary.bookings.length) bHost.appendChild(h('p', { class: 'empty-note' }, ['尚無預約紀錄']));
    summary.bookings.forEach(function (b) {
      var plan = Store.getPlans().find(function (p) { return p.id === b.planId; });
      bHost.appendChild(h('div', { class: 'booking-row' }, [
        h('div', { class: 'b-info' }, [
          h('span', {}, [Store.formatDateDisplay(b.startDate) + ' ~ ' + Store.formatDateDisplay(b.endDate)]),
          h('span', {}, [plan ? plan.name : '（已刪除方案）'])
        ]),
        h('span', { class: 'pill status-' + b.status }, [b.status])
      ]));
    });
    var fHost = $('custDetailFees');
    fHost.replaceChildren();
    if (!summary.fees.length) fHost.appendChild(h('p', { class: 'empty-note' }, ['尚無費用紀錄']));
    summary.fees.forEach(function (f) {
      fHost.appendChild(h('div', { class: 'booking-row' }, [
        h('div', { class: 'b-info' }, [h('span', {}, [f.item]), h('span', {}, [Store.formatPrice(f.price)])]),
        h('span', { class: 'pill status-' + f.status }, [f.status])
      ]));
    });
    $('custDetailUnpaid').textContent = '待付款合計 ' + Store.formatPrice(summary.unpaidTotal);
    $('customerDetailDialog').showModal();
  }

  function bindCustomerForm() {
    $('newCustomerBtn').addEventListener('click', function () { openCustomerDialog(null); });
    $('customerSearch').addEventListener('input', renderCustomerList);
    $('customerForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('cuName').value.trim();
      var phone = $('cuPhone').value.trim();
      if (!name || !phone) { Store.toast('請填寫姓名與電話', 'error'); return; }
      var payload = {
        name: name.slice(0, 100), phone: phone.slice(0, 100),
        petName: $('cuPet').value.trim().slice(0, 100), notes: $('cuNotes').value.slice(0, 300)
      };
      var p = editingCustomerId ? Store.updateCustomer(editingCustomerId, payload) : Store.addCustomer(payload);
      p.then(function () {
        $('customerDialog').close();
        renderCustomerList();
        Store.toast('已儲存客戶資料', 'success');
      }).catch(function () {});
    });
    $('cuDelete').addEventListener('click', function () {
      if (!editingCustomerId) return;
      var summary = Store.customerSummary(editingCustomerId);
      if (!confirm('將同時刪除 ' + summary.bookings.length + ' 筆預約、' + summary.fees.length + ' 筆費用，確定要刪除這位客戶嗎？')) return;
      Store.deleteCustomerCascade(editingCustomerId).then(function () {
        $('customerDialog').close();
        renderCustomerList();
        Store.toast('已刪除客戶', 'success');
      });
    });
  }

  // ---------------- fees ----------------
  var feeState = { statusFilter: 'all' };
  var editingFeeId = null;

  function renderFeeList() {
    var fees = Store.getFees();
    var totals = { 待付款: 0, 已付款: 0, 已取消: 0 };
    fees.forEach(function (f) { totals[f.status] = (totals[f.status] || 0) + f.price; });
    var totalsHost = $('feeTotals');
    totalsHost.replaceChildren();
    Object.keys(totals).forEach(function (k) {
      totalsHost.appendChild(h('div', { class: 'total-pill' }, [k + '：', h('strong', {}, [Store.formatPrice(totals[k])])]));
    });
    var list = feeState.statusFilter === 'all' ? fees : fees.filter(function (f) { return f.status === feeState.statusFilter; });
    var body = $('feeTableBody');
    body.replaceChildren();
    list.forEach(function (f) {
      var cust = Store.getCustomers().find(function (c) { return c.id === f.customerId; });
      var custLabel = cust ? cust.name : '（已刪除客戶）';
      var statusSelect = h('select', { class: 'status-select', 'aria-label': custLabel + '　' + f.item + ' 的費用狀態' });
      ['待付款', '已付款', '已取消'].forEach(function (s) { statusSelect.appendChild(h('option', { value: s }, [s])); });
      statusSelect.value = f.status;
      statusSelect.addEventListener('change', function () {
        Store.updateFee(f.id, { status: statusSelect.value }).then(function () {
          renderFeeList();
          Store.toast('費用狀態已更新', 'success');
        });
      });
      var editBtn = makeBtn('編輯', 'btn-secondary', function () { openFeeDialog(f); });
      var tr = h('tr', {}, [
        h('td', {}, [custLabel]),
        h('td', {}, [f.item]),
        h('td', {}, [Store.formatPrice(f.price)]),
        h('td', {}, [statusSelect]),
        h('td', {}, [editBtn])
      ]);
      body.appendChild(tr);
    });
  }

  function populateBookingOptionsForCustomer(customerId, selectedBookingId) {
    var sel = $('feBooking');
    sel.replaceChildren();
    sel.appendChild(h('option', { value: '' }, ['（不指定）']));
    Store.getBookings().filter(function (b) { return b.customerId === customerId; }).forEach(function (b) {
      var plan = Store.getPlans().find(function (p) { return p.id === b.planId; });
      sel.appendChild(h('option', { value: b.id }, [Store.formatDateDisplay(b.startDate) + '~' + Store.formatDateDisplay(b.endDate) + '　' + (plan ? plan.name : '（已刪除方案）')]));
    });
    sel.value = selectedBookingId || '';
  }

  function openFeeDialog(fee, prefill) {
    editingFeeId = fee ? fee.id : null;
    $('feeDialogTitle').textContent = fee ? '編輯費用' : '新增費用';
    $('feeForm').reset();
    populateSelect('feCustomer', Store.getCustomers(), function (c) { return c.id; }, function (c) { return c.name; });
    var custId = fee ? fee.customerId : (prefill && prefill.customerId) || (Store.getCustomers()[0] && Store.getCustomers()[0].id) || '';
    $('feCustomer').value = custId;
    populateBookingOptionsForCustomer(custId, fee ? fee.bookingId : (prefill && prefill.bookingId));
    $('feItem').value = fee ? fee.item : (prefill && prefill.item) || '';
    $('fePrice').value = fee ? fee.price : (prefill && prefill.price != null ? prefill.price : '');
    $('feNotes').value = fee ? fee.notes : '';
    $('feStatus').value = fee ? fee.status : '待付款';
    $('feDelete').hidden = !fee;
    $('feeDialog').showModal();
  }

  function bindFeeForm() {
    $('newFeeBtn').addEventListener('click', function () { openFeeDialog(null); });
    $('feCustomer').addEventListener('change', function () { populateBookingOptionsForCustomer(this.value, null); });
    $('feeForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var item = $('feItem').value.trim();
      var price = parseStrictNonNegInt($('fePrice').value);
      if (!item) { Store.toast('請輸入品項', 'error'); return; }
      if (price === null) { Store.toast('請輸入 0 以上的整數', 'error'); return; }
      if (!$('feCustomer').value) { Store.toast('請選擇客戶', 'error'); return; }
      var payload = {
        customerId: $('feCustomer').value, bookingId: $('feBooking').value || null,
        item: item.slice(0, 100), price: price,
        notes: $('feNotes').value.slice(0, 300), status: $('feStatus').value
      };
      var p = editingFeeId ? Store.updateFee(editingFeeId, payload) : Store.addFee(payload);
      p.then(function () {
        $('feeDialog').close();
        renderFeeList();
        Store.toast('已儲存費用', 'success');
      }).catch(function () {});
    });
    $('feDelete').addEventListener('click', function () {
      if (!editingFeeId) return;
      if (!confirm('確定要刪除這筆費用嗎？')) return;
      Store.deleteFee(editingFeeId).then(function () {
        $('feeDialog').close();
        renderFeeList();
        Store.toast('已刪除費用', 'success');
      });
    });
    bindStatusFilterGroup('feeStatusFilter', function (s) { feeState.statusFilter = s; renderFeeList(); });
  }

  // ---------------- folders / photos ----------------
  var folderState = { currentFolderId: null };
  var editingFolderId = null;

  function renderFolderList() {
    var host = $('folderCardList');
    host.replaceChildren();
    Store.getFolders().forEach(function (f) {
      var count = Store.getPhotos(f.id).length;
      var card = h('div', { class: 'data-card' }, [
        h('div', { class: 'card-title' }, [f.name]),
        h('div', { class: 'card-sub' }, [count + ' 張照片']),
        h('div', { class: 'card-actions' }, [
          makeBtn('管理照片', 'btn-secondary', function () { openFolderDetail(f.id); }),
          makeBtn('刪除', 'btn-danger', function () {
            if (!confirm('刪除資料夾「' + f.name + '」將同時刪除 ' + count + ' 張照片，確定要刪除嗎？')) return;
            Store.deleteFolder(f.id).then(function () { renderFolderList(); Store.toast('已刪除資料夾', 'success'); });
          })
        ])
      ]);
      card.addEventListener('click', function () { openFolderDetail(f.id); });
      host.appendChild(card);
    });
  }

  function openFolderDetail(id) {
    folderState.currentFolderId = id;
    var folder = Store.getFolders().find(function (f) { return f.id === id; });
    if (!folder) return;
    $('folderListView').hidden = true;
    $('folderDetailView').hidden = false;
    $('folderDetailTitle').textContent = folder.name;
    renderAdminPhotoGrid();
  }

  function renderAdminPhotoGrid() {
    var folderId = folderState.currentFolderId;
    var folder = Store.getFolders().find(function (f) { return f.id === folderId; });
    var photos = Store.getPhotos(folderId);
    var grid = $('adminPhotoGrid');
    grid.replaceChildren();
    if (!photos.length) { grid.appendChild(h('p', { class: 'empty-note' }, ['這個資料夾還沒有照片'])); return; }
    photos.forEach(function (p) {
      var card = h('div', { class: 'admin-photo-card' });
      Store.getImage(p.imageId).then(function (url) { if (url) card.prepend(h('img', { src: url, alt: '' })); });
      if (folder && folder.coverImageId === p.imageId) card.appendChild(h('div', { class: 'cover-badge' }, ['封面']));
      var actions = h('div', { class: 'apc-actions' }, [
        makeBtn('設為封面', 'btn-secondary', function () {
          Store.setCover(folderId, p.imageId).then(function () { renderAdminPhotoGrid(); Store.toast('已設為封面', 'success'); });
        }),
        makeBtn('刪除', 'btn-danger', function () {
          if (!confirm('確定要刪除這張照片嗎？')) return;
          Store.deletePhoto(p.id).then(function () { renderAdminPhotoGrid(); Store.toast('已刪除照片', 'success'); });
        })
      ]);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  function bindFolderUI() {
    $('newFolderBtn').addEventListener('click', function () {
      editingFolderId = null;
      $('folderDialogTitle').textContent = '新增資料夾';
      $('folderForm').reset();
      $('folderDialog').showModal();
    });
    $('renameFolderBtn').addEventListener('click', function () {
      var folder = Store.getFolders().find(function (f) { return f.id === folderState.currentFolderId; });
      editingFolderId = folderState.currentFolderId;
      $('folderDialogTitle').textContent = '重新命名資料夾';
      $('folderForm').reset();
      $('foName').value = folder ? folder.name : '';
      $('folderDialog').showModal();
    });
    $('folderForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('foName').value.trim();
      if (!name) { Store.toast('請輸入資料夾名稱', 'error'); return; }
      var p = editingFolderId ? Store.renameFolder(editingFolderId, name.slice(0, 100)) : Store.addFolder(name.slice(0, 100));
      p.then(function () {
        $('folderDialog').close();
        renderFolderList();
        if (editingFolderId && folderState.currentFolderId === editingFolderId) $('folderDetailTitle').textContent = name;
        Store.toast('已儲存資料夾', 'success');
      }).catch(function () {});
    });
    $('backToFolders').addEventListener('click', function () {
      $('folderDetailView').hidden = true;
      $('folderListView').hidden = false;
      renderFolderList();
    });
    $('photoUploadInput').addEventListener('change', function () {
      var files = Array.from(this.files || []);
      this.value = '';
      if (!files.length) return;
      var folderId = folderState.currentFolderId;
      var progress = $('uploadProgress');
      var done = 0;
      progress.textContent = '處理中…（0/' + files.length + '）';
      var chain = Promise.resolve();
      files.forEach(function (file) {
        chain = chain.then(function () {
          return Store.addPhotoToFolder(folderId, file).then(function () {
            done++; progress.textContent = '處理中…（' + done + '/' + files.length + '）';
          }).catch(function (err) {
            done++; Store.toast(err.message || '有一張照片上傳失敗', 'error');
          });
        });
      });
      chain.then(function () {
        progress.textContent = '';
        renderAdminPhotoGrid();
        renderFolderList();
      });
    });
  }

  // ---------------- plans ----------------
  var editingPlanId = null;

  function renderPlanList() {
    var host = $('planList');
    host.replaceChildren();
    Store.getPlans().forEach(function (p) {
      var card = h('div', { class: 'data-card' }, [
        h('div', { class: 'card-title' }, [p.name + (p.recommended ? '（推薦）' : '')]),
        h('div', { class: 'card-sub' }, [Store.formatPrice(p.price) + (p.desc ? '　' + p.desc : '')]),
        h('div', { class: 'card-actions' }, [makeBtn('編輯', 'btn-secondary', function () { openPlanDialog(p); })])
      ]);
      host.appendChild(card);
    });
  }
  function openPlanDialog(plan) {
    editingPlanId = plan ? plan.id : null;
    $('planDialogTitle').textContent = plan ? '編輯方案' : '新增方案';
    $('planForm').reset();
    $('plName').value = plan ? plan.name : '';
    $('plPrice').value = plan ? plan.price : '';
    $('plDesc').value = plan ? plan.desc : '';
    $('plRecommended').checked = plan ? !!plan.recommended : false;
    $('plDelete').hidden = !plan;
    $('planDialog').showModal();
  }
  function bindPlanForm() {
    $('newPlanBtn').addEventListener('click', function () { openPlanDialog(null); });
    $('planForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('plName').value.trim();
      var price = parseStrictNonNegInt($('plPrice').value);
      if (!name) { Store.toast('請輸入名稱', 'error'); return; }
      if (price === null) { Store.toast('請輸入 0 以上的整數', 'error'); return; }
      var payload = { name: name.slice(0, 100), price: price, desc: $('plDesc').value.trim().slice(0, 100), recommended: $('plRecommended').checked };
      var p = editingPlanId ? Store.updatePlan(editingPlanId, payload) : Store.addPlan(payload);
      p.then(function () {
        $('planDialog').close();
        renderPlanList();
        Store.toast('已儲存方案', 'success');
      }).catch(function () {});
    });
    $('plDelete').addEventListener('click', function () {
      if (!editingPlanId) return;
      var count = Store.countBookingsForPlan(editingPlanId);
      var msg = count > 0
        ? '目前有 ' + count + ' 筆預約使用此方案，刪除後這些預約會顯示「已刪除方案」。確定要刪除嗎？'
        : '確定要刪除這個方案嗎？';
      if (!confirm(msg)) return;
      Store.deletePlan(editingPlanId).then(function () {
        $('planDialog').close();
        renderPlanList();
        Store.toast('已刪除方案', 'success');
      });
    });
  }

  // ---------------- messages ----------------
  function renderMessageList() {
    var host = $('messageList');
    host.replaceChildren();
    var messages = Store.getMessages().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!messages.length) { host.appendChild(h('p', { class: 'empty-note' }, ['尚無留言'])); return; }
    messages.forEach(function (m) {
      var d = new Date(m.date);
      var dateStr = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
      var photosHost = h('div', { class: 'msg-photos' });
      var card = h('div', { class: 'list-card' }, [
        h('div', { class: 'b-info' }, [
          h('strong', {}, [m.name + '　' + dateStr]),
          h('span', {}, [m.text]),
          photosHost
        ]),
        makeBtn('刪除', 'btn-danger', function () {
          if (!confirm('確定要刪除這則留言嗎？')) return;
          Store.deleteMessage(m.id).then(function () { renderMessageList(); Store.toast('已刪除留言', 'success'); });
        })
      ]);
      if (m.photoIds && m.photoIds.length) {
        Promise.all(m.photoIds.map(function (id) { return Store.getImage(id); })).then(function (urls) {
          urls.forEach(function (url) {
            if (url) photosHost.appendChild(h('img', { src: url, alt: '', class: 'msg-photo-thumb' }));
          });
        });
      }
      host.appendChild(card);
    });
  }

  // ---------------- settings ----------------
  function renderSettingsForm() {
    var s = Store.getSettings();
    $('setBrand').value = s.brandTitle;
    $('setSlogan1').value = s.slogan1;
    $('setSlogan2').value = s.slogan2;
    $('setSlogan3').value = s.slogan3;
    $('setHours1').value = s.hours1;
    $('setHours2').value = s.hours2;
    $('setLine').value = s.lineUrl;
    renderHeroSettingsGrid();
  }
  function renderHeroSettingsGrid() {
    var s = Store.getSettings();
    var host = $('heroSettingsGrid');
    host.replaceChildren();
    [0, 1, 2].forEach(function (i) {
      var imgHost = h('div', {});
      var imgId = s.heroImageIds[i];
      if (imgId) {
        Store.getImage(imgId).then(function (url) { if (url) imgHost.appendChild(h('img', { src: url, alt: '' })); });
      } else {
        imgHost.appendChild(h('p', { class: 'empty-note' }, ['尚未上傳，將顯示預設圖案']));
      }
      var fileId = 'heroFile' + i;
      var fileInput = h('input', {
        type: 'file', accept: 'image/*', id: fileId, class: 'visually-hidden',
        'aria-label': '上傳首頁照片 ' + (i + 1)
      });
      var fileLabel = h('label', { for: fileId, class: 'btn-secondary file-picker-btn' }, [imgId ? '更換照片' : '上傳照片']);
      var removeBtn = makeBtn('移除', 'btn-secondary', function () {
        Store.removeHeroImage(i).then(function () { renderHeroSettingsGrid(); Store.toast('已移除照片', 'success'); });
      });
      removeBtn.hidden = !imgId;
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        Store.setHeroImage(i, file).then(function () {
          renderHeroSettingsGrid();
          Store.toast('已更新照片', 'success');
        }).catch(function (err) { Store.toast(err.message || '圖片上傳失敗', 'error'); });
      });
      host.appendChild(h('div', { class: 'hero-setting' }, [
        h('strong', {}, ['首頁照片 ' + (i + 1)]),
        imgHost, fileInput, fileLabel, removeBtn
      ]));
    });
  }
  function bindSettingsForm() {
    $('settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var lineUrl = $('setLine').value.trim();
      if (lineUrl && lineUrl.indexOf('https://line.me/') !== 0 && lineUrl.indexOf('https://lin.ee/') !== 0) {
        Store.toast('LINE 連結需為 https://line.me/ 或 https://lin.ee/ 開頭，或留空', 'error');
        return;
      }
      var payload = {
        brandTitle: $('setBrand').value.trim().slice(0, 100) || '豬仔仔幼兒園',
        slogan1: $('setSlogan1').value.trim().slice(0, 100),
        slogan2: $('setSlogan2').value.trim().slice(0, 100),
        slogan3: $('setSlogan3').value.trim().slice(0, 100),
        hours1: $('setHours1').value.trim().slice(0, 100),
        hours2: $('setHours2').value.trim().slice(0, 100),
        lineUrl: lineUrl
      };
      Store.updateSettings(payload).then(function () { Store.toast('設定已儲存', 'success'); }).catch(function () {});
    });
  }

  function buildDbFailNote() {
    return h('div', { class: 'dbfail' }, [
      h('h2', {}, ['無法使用本機儲存']),
      h('p', {}, ['您的瀏覽器不支援或已停用 IndexedDB（例如隱私瀏覽模式）。此 Demo 需要瀏覽器儲存空間才能運作，請更換瀏覽器或關閉隱私瀏覽模式後再重新整理頁面。'])
    ]);
  }

  (async function init() {
    initLogin();
    initNav();
    bindBookingForm();
    bindCustomerForm();
    bindFeeForm();
    bindFolderUI();
    bindPlanForm();
    bindSettingsForm();

    var t = new Date();
    calState.year = t.getFullYear(); calState.month = t.getMonth(); calState.selectedDate = Store.todayISO();

    await Store.ready;
    if (Store.dbUnavailable) {
      document.body.replaceChildren(buildDbFailNote());
      return;
    }
    var loggedIn = false;
    try { loggedIn = sessionStorage.getItem(LOGIN_KEY) === '1'; } catch (e) {}
    if (loggedIn) showApp();

    // Two-tab safety net (item 6): store.js already refreshes its cache on
    // visibilitychange; re-render whatever view is on screen so it reflects
    // what the OTHER tab saved, instead of looking stale or reverting it.
    window.addEventListener('store:refreshed', function () {
      if (!$('appShell').hidden) showView(currentView);
    });
  })();
})();

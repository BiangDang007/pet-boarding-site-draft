// store.js — shared data layer for 豬仔仔幼兒園 demo (index.html + admin.html)
// Works as a browser script (defines window.Store) and via require() in Node (test.js).
(function (root) {
  'use strict';

  var DB_NAME = 'zhuzaizai-demo';
  var STORE_NAME = 'kv';
  var DATA_KEY = 'data';

  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  // ---------------------------------------------------------------------
  // Pure functions — take the data object as a plain argument so they can
  // run in Node without any IndexedDB dependency.
  // ---------------------------------------------------------------------

  function bookingsOnDay(data, dayStr) {
    return data.bookings.filter(function (b) {
      return b.startDate <= dayStr && dayStr <= b.endDate;
    });
  }

  function customerSummary(data, customerId) {
    var bookings = data.bookings.filter(function (b) { return b.customerId === customerId; });
    var fees = data.fees.filter(function (f) { return f.customerId === customerId; });
    var unpaidTotal = fees
      .filter(function (f) { return f.status === '待付款'; })
      .reduce(function (sum, f) { return sum + f.price; }, 0);
    return { bookings: bookings, fees: fees, unpaidTotal: unpaidTotal };
  }

  // Policy: cascade. Alternative: block deletion while records exist. Owner's call.
  function deleteCustomerCascade(data, customerId) {
    var removedBookings = data.bookings.filter(function (b) { return b.customerId === customerId; });
    var removedFees = data.fees.filter(function (f) { return f.customerId === customerId; });
    data.bookings = data.bookings.filter(function (b) { return b.customerId !== customerId; });
    data.fees = data.fees.filter(function (f) { return f.customerId !== customerId; });
    data.customers = data.customers.filter(function (c) { return c.id !== customerId; });
    return { bookings: removedBookings.length, fees: removedFees.length };
  }

  function feeDefaultsFromBooking(data, bookingId) {
    var booking = data.bookings.find(function (b) { return b.id === bookingId; });
    if (!booking) return { item: '', price: 0 };
    var plan = data.plans.find(function (p) { return p.id === booking.planId; });
    if (!plan) return { item: '', price: 0 };
    return { item: plan.name, price: plan.price };
  }

  function formatPrice(n) {
    return 'NT$ ' + Number(n || 0).toLocaleString('en-US');
  }

  function formatDateDisplay(iso) {
    if (!iso) return '';
    return iso.replace(/-/g, '/');
  }

  // ---------------------------------------------------------------------
  // Seed data — clearly fake demo content, computed from "today" so
  // bookings always land inside the current month.
  // ---------------------------------------------------------------------

  function seedData() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth(); // 0-indexed
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    function dateStr(day) {
      day = Math.min(Math.max(day, 1), daysInMonth);
      return year + '-' + pad2(month + 1) + '-' + pad2(day);
    }

    var plans = [
      { id: uid(), name: '示意方案 A', price: 500, desc: '方案說明（後台可編輯）', recommended: false },
      { id: uid(), name: '示意方案 B', price: 800, desc: '方案說明（後台可編輯）', recommended: true },
      { id: uid(), name: '示意方案 C', price: 1200, desc: '方案說明（後台可編輯）', recommended: false }
    ];

    var petNo = ['一', '二', '三', '四', '五'];
    var customers = ['範例客戶 A', '範例客戶 B', '範例客戶 C', '範例客戶 D', '範例客戶 E'].map(function (name, i) {
      return { id: uid(), name: name, phone: '0900-000-00' + (i + 1), petName: '毛孩' + petNo[i] + '號', notes: '' };
    });

    var statuses = ['待確認', '已確認', '已取消'];
    // day offsets into current month; two are ranges (multi-day)
    var bookingDefs = [
      { start: 2, end: 2 },
      { start: 5, end: 5 },
      { start: 8, end: 8 },
      { start: 10, end: 12 },
      { start: 14, end: 14 },
      { start: 18, end: 18 },
      { start: 20, end: 23 },
      { start: 26, end: 26 }
    ];
    var bookings = bookingDefs.map(function (def, i) {
      return {
        id: uid(),
        customerId: customers[i % customers.length].id,
        planId: plans[i % plans.length].id,
        startDate: dateStr(def.start),
        endDate: dateStr(def.end),
        notes: '示意備註',
        status: statuses[i % statuses.length]
      };
    });

    var feeStatuses = ['待付款', '已付款', '已取消', '待付款', '已付款'];
    var partialData = { plans: plans, bookings: bookings };
    var fees = bookings.slice(0, 5).map(function (b, i) {
      var d = feeDefaultsFromBooking(partialData, b.id);
      return {
        id: uid(),
        customerId: b.customerId,
        bookingId: b.id,
        item: d.item,
        price: d.price,
        notes: '',
        status: feeStatuses[i]
      };
    });

    var folders = ['示意資料夾 一', '示意資料夾 二', '示意資料夾 三'].map(function (name) {
      return { id: uid(), name: name, coverImageId: null };
    });

    var messages = [
      { id: uid(), name: '訪客', text: '留言示意：環境看起來很不錯！', photoIds: [], date: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: uid(), name: '路過客人', text: '留言示意：想請問價格方案的細節。', photoIds: [], date: new Date(Date.now() - 86400000).toISOString() }
    ];

    return {
      settings: {
        brandTitle: '豬仔仔幼兒園',
        slogan1: '爸媽放心出遊',
        slogan2: '足夠玩耍空間',
        slogan3: '別羨慕豬仔圓圓胖胖',
        hours1: '週一至週五 09:00–21:00',
        hours2: '週六 10:00–16:00',
        lineUrl: '',
        heroImageIds: [null, null, null]
      },
      plans: plans,
      customers: customers,
      bookings: bookings,
      fees: fees,
      folders: folders,
      photos: [], // {id, folderId, imageId}
      messages: messages
    };
  }

  var pureApi = {
    bookingsOnDay: bookingsOnDay,
    customerSummary: customerSummary,
    deleteCustomerCascade: deleteCustomerCascade,
    feeDefaultsFromBooking: feeDefaultsFromBooking,
    formatPrice: formatPrice,
    formatDateDisplay: formatDateDisplay,
    seedData: seedData,
    todayISO: todayISO,
    uid: uid
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = pureApi;
  }

  // ---------------------------------------------------------------------
  // Browser-only: IndexedDB persistence + small shared UI helpers.
  // Guarded so requiring this file in Node never touches indexedDB/DOM.
  // ---------------------------------------------------------------------
  if (typeof window === 'undefined') return;

  var cache = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('open-failed')); };
    });
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var r = tx.objectStore(STORE_NAME).get(key);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function idbSet(key, val) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(val, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbDelete(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  // ---- tiny DOM builder shared by app.js + admin.js (never uses innerHTML) ----
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof el[k] !== 'function') el[k] = v;
      else el.setAttribute(k, v);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  // ---- toast (shared aria-live region, both pages include #toast-region) ----
  var toastTimer = null;
  function toast(message, type) {
    var region = document.getElementById('toast-region');
    if (!region) { console.warn('[toast]', message); return; }
    region.textContent = '';
    var box = document.createElement('div');
    box.className = 'toast toast-' + (type || 'info');
    box.textContent = message;
    region.appendChild(box);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (region.contains(box)) region.removeChild(box);
    }, type === 'error' ? 6000 : 3200);
  }

  function notifyError(message) {
    toast(message, 'error');
  }

  // Read-modify-write commit — runs entirely inside ONE IndexedDB readwrite
  // transaction: get the freshest stored 'data' -> mutateFn(data) mutates
  // that fresh object -> put it back -> update the in-memory cache only on
  // tx success. This is what keeps two open tabs from clobbering each
  // other: each commit starts from whatever the OTHER tab last saved,
  // instead of blindly overwriting with a possibly-stale in-memory copy.
  function commit(mutateFn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var result, freshData, mutateError, settled = false;

        function fail(err) {
          if (settled) return;
          settled = true;
          notifyError('儲存失敗，請確認瀏覽器儲存空間是否足夠，或關閉隱私瀏覽模式後再試一次。');
          reject(err);
        }

        var getReq = store.get(DATA_KEY);
        getReq.onsuccess = function () {
          freshData = getReq.result || seedData();
          try {
            result = mutateFn(freshData);
            store.put(freshData, DATA_KEY);
          } catch (e) {
            mutateError = e;
            try { tx.abort(); } catch (e2) {}
          }
        };
        tx.oncomplete = function () {
          if (settled) return;
          if (mutateError) { settled = true; reject(mutateError); return; }
          settled = true;
          cache = freshData;
          resolve(result);
        };
        tx.onerror = function () { fail(tx.error); };
        tx.onabort = function () { fail(mutateError || tx.error || new Error('transaction aborted')); };
      });
    });
  }

  function refreshCache() {
    return idbGet(DATA_KEY).then(function (saved) {
      if (saved) cache = saved;
      return cache;
    });
  }

  function saveImage(id, dataURL) {
    return idbSet('img:' + id, dataURL).catch(function (err) {
      notifyError('儲存失敗，圖片無法儲存，請確認瀏覽器儲存空間。');
      throw err;
    });
  }

  function processImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || file.type.indexOf('image/') !== 0) {
        reject(new Error('請選擇圖片檔案。'));
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        reject(new Error('圖片檔案過大（上限 15MB）。'));
        return;
      }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxSide = 1280;
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('圖片讀取失敗，請換一張圖片。'));
      };
      img.src = url;
    });
  }

  var Store = {
    dbUnavailable: false,
    h: h,
    toast: toast,
    formatPrice: formatPrice,
    formatDateDisplay: formatDateDisplay,
    todayISO: todayISO,
    bookingsOnDay: function (dayStr) { return bookingsOnDay(cache, dayStr); },
    customerSummary: function (customerId) { return customerSummary(cache, customerId); },
    feeDefaultsFromBooking: function (bookingId) { return feeDefaultsFromBooking(cache, bookingId); },

    getData: function () { return cache; },
    getSettings: function () { return cache.settings; },
    getPlans: function () { return cache.plans; },
    getCustomers: function () { return cache.customers; },
    getBookings: function () { return cache.bookings; },
    getFees: function () { return cache.fees; },
    getFolders: function () { return cache.folders; },
    getPhotos: function (folderId) {
      return cache.photos.filter(function (p) { return p.folderId === folderId; });
    },
    getMessages: function () { return cache.messages; },
    refreshCache: refreshCache,

    getImage: function (id) {
      if (!id) return Promise.resolve(null);
      return idbGet('img:' + id).catch(function () { return null; });
    },
    processImageFile: processImageFile,

    updateSettings: function (patch) {
      return commit(function (data) { Object.assign(data.settings, patch); });
    },

    addPlan: function (plan) {
      var rec = { id: uid(), name: plan.name, price: plan.price, desc: plan.desc || '', recommended: !!plan.recommended };
      return commit(function (data) { data.plans.push(rec); }).then(function () { return rec; });
    },
    updatePlan: function (id, patch) {
      return commit(function (data) {
        var p = data.plans.find(function (x) { return x.id === id; });
        if (p) Object.assign(p, patch);
      });
    },
    deletePlan: function (id) {
      return commit(function (data) { data.plans = data.plans.filter(function (p) { return p.id !== id; }); });
    },
    countBookingsForPlan: function (id) {
      return cache.bookings.filter(function (b) { return b.planId === id; }).length;
    },

    addCustomer: function (c) {
      var rec = { id: uid(), name: c.name, phone: c.phone || '', petName: c.petName || '', notes: c.notes || '' };
      return commit(function (data) { data.customers.push(rec); }).then(function () { return rec; });
    },
    updateCustomer: function (id, patch) {
      return commit(function (data) {
        var c = data.customers.find(function (x) { return x.id === id; });
        if (c) Object.assign(c, patch);
      });
    },
    deleteCustomerCascade: function (id) {
      var result;
      return commit(function (data) { result = deleteCustomerCascade(data, id); }).then(function () { return result; });
    },

    addBooking: function (b) {
      var rec = { id: uid(), customerId: b.customerId, planId: b.planId, startDate: b.startDate, endDate: b.endDate, notes: b.notes || '', status: b.status || '待確認' };
      return commit(function (data) { data.bookings.push(rec); }).then(function () { return rec; });
    },
    updateBooking: function (id, patch) {
      return commit(function (data) {
        var b = data.bookings.find(function (x) { return x.id === id; });
        if (b) Object.assign(b, patch);
      });
    },
    deleteBooking: function (id) {
      return commit(function (data) { data.bookings = data.bookings.filter(function (b) { return b.id !== id; }); });
    },

    addFee: function (f) {
      var rec = { id: uid(), customerId: f.customerId, bookingId: f.bookingId || null, item: f.item, price: f.price, notes: f.notes || '', status: f.status || '待付款' };
      return commit(function (data) { data.fees.push(rec); }).then(function () { return rec; });
    },
    updateFee: function (id, patch) {
      return commit(function (data) {
        var f = data.fees.find(function (x) { return x.id === id; });
        if (f) Object.assign(f, patch);
      });
    },
    deleteFee: function (id) {
      return commit(function (data) { data.fees = data.fees.filter(function (f) { return f.id !== id; }); });
    },

    addFolder: function (name) {
      var rec = { id: uid(), name: name, coverImageId: null };
      return commit(function (data) { data.folders.push(rec); }).then(function () { return rec; });
    },
    renameFolder: function (id, name) {
      return commit(function (data) {
        var f = data.folders.find(function (x) { return x.id === id; });
        if (f) f.name = name;
      });
    },
    deleteFolder: function (id) {
      var photoIds = [];
      return commit(function (data) {
        photoIds = data.photos.filter(function (p) { return p.folderId === id; }).map(function (p) { return p.imageId; });
        data.photos = data.photos.filter(function (p) { return p.folderId !== id; });
        data.folders = data.folders.filter(function (f) { return f.id !== id; });
      }).then(function () {
        photoIds.forEach(function (imgId) { idbDelete('img:' + imgId).catch(function () {}); });
      });
    },
    addPhotoToFolder: function (folderId, file) {
      return processImageFile(file).then(function (dataURL) {
        var imgId = uid();
        return saveImage(imgId, dataURL).then(function () {
          var rec = { id: uid(), folderId: folderId, imageId: imgId };
          return commit(function (data) {
            data.photos.push(rec);
            var folder = data.folders.find(function (f) { return f.id === folderId; });
            if (folder && !folder.coverImageId) folder.coverImageId = imgId;
          }).then(function () { return rec; });
        });
      });
    },
    setCover: function (folderId, imageId) {
      return commit(function (data) {
        var f = data.folders.find(function (x) { return x.id === folderId; });
        if (f) f.coverImageId = imageId;
      });
    },
    deletePhoto: function (photoId) {
      var rec;
      return commit(function (data) {
        rec = data.photos.find(function (p) { return p.id === photoId; });
        data.photos = data.photos.filter(function (p) { return p.id !== photoId; });
        if (rec) {
          data.folders.forEach(function (f) {
            if (f.coverImageId === rec.imageId) {
              var next = data.photos.find(function (p) { return p.folderId === f.id; });
              f.coverImageId = next ? next.imageId : null;
            }
          });
        }
      }).then(function () {
        if (rec) idbDelete('img:' + rec.imageId).catch(function () {});
      });
    },

    addMessage: function (msg, files) {
      files = files || [];
      return Promise.all(files.map(function (file) {
        return processImageFile(file).then(function (dataURL) {
          var imgId = uid();
          return saveImage(imgId, dataURL).then(function () { return imgId; });
        });
      })).then(function (photoIds) {
        var rec = { id: uid(), name: msg.name, text: msg.text, photoIds: photoIds, date: new Date().toISOString() };
        return commit(function (data) { data.messages.push(rec); }).then(function () { return rec; });
      });
    },
    deleteMessage: function (id) {
      var rec;
      return commit(function (data) {
        rec = data.messages.find(function (m) { return m.id === id; });
        data.messages = data.messages.filter(function (m) { return m.id !== id; });
      }).then(function () {
        if (rec) rec.photoIds.forEach(function (imgId) { idbDelete('img:' + imgId).catch(function () {}); });
      });
    },

    setHeroImage: function (index, file) {
      return processImageFile(file).then(function (dataURL) {
        var imgId = uid();
        return saveImage(imgId, dataURL).then(function () {
          return commit(function (data) { data.settings.heroImageIds[index] = imgId; }).then(function () { return imgId; });
        });
      });
    },
    removeHeroImage: function (index) {
      var oldId;
      return commit(function (data) {
        oldId = data.settings.heroImageIds[index];
        data.settings.heroImageIds[index] = null;
      }).then(function () {
        if (oldId) idbDelete('img:' + oldId).catch(function () {});
      });
    },

    resetDemo: function () {
      var fresh = seedData();
      return idbSet(DATA_KEY, fresh).then(function () {
        cache = fresh;
      }).catch(function (err) {
        notifyError('重置失敗，請重新整理頁面再試一次。');
        throw err;
      });
    }
  };

  Store.ready = (function init() {
    if (typeof indexedDB === 'undefined') {
      Store.dbUnavailable = true;
      return Promise.resolve();
    }
    return idbGet(DATA_KEY).then(function (saved) {
      if (!saved) {
        saved = seedData();
        return idbSet(DATA_KEY, saved).then(function () { cache = saved; });
      }
      cache = saved;
    }).catch(function () {
      Store.dbUnavailable = true;
    });
  })();

  // Two-tab safety net: when this tab regains visibility, pull whatever the
  // other tab last saved and tell the page to re-render. The commit()
  // transaction above already guarantees no writes are lost; this just
  // keeps a backgrounded tab's on-screen data from looking stale.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && cache && !Store.dbUnavailable) {
        refreshCache().then(function () {
          root.dispatchEvent(new CustomEvent('store:refreshed'));
        });
      }
    });
  }

  root.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);

// app.js — public homepage logic (index.html)
(function () {
  'use strict';
  var h = Store.h;

  function bindBanner() {
    var closeBtn = document.getElementById('bannerClose');
    closeBtn.addEventListener('click', function () {
      try { sessionStorage.setItem('zz-banner-dismissed', '1'); } catch (e) {}
      document.getElementById('banner').style.display = 'none';
    });
  }

  function handleLineClick() {
    var url = Store.getSettings().lineUrl;
    if (url) window.open(url, '_blank', 'noopener');
    else Store.toast('Demo：正式版會直接開啟您的 LINE', 'info');
  }
  function bindLineButtons() {
    document.getElementById('lineBtn').addEventListener('click', handleLineClick);
    document.getElementById('lineBtnSticky').addEventListener('click', handleLineClick);
  }

  function renderBrand() {
    var s = Store.getSettings();
    document.getElementById('brandTitleText').textContent = s.brandTitle;
    document.title = s.brandTitle + '｜Demo 示意版';
    document.getElementById('hoursLines').textContent = s.hours1 + '\n' + s.hours2;
  }

  function renderHero() {
    var s = Store.getSettings();
    var host = document.getElementById('hero');
    host.replaceChildren();
    [0, 1, 2].forEach(function (i) {
      var tpl = document.getElementById('tpl-hero-' + i);
      var node = tpl.content.cloneNode(true);
      var frame = node.querySelector('.photo-frame');
      var img = node.querySelector('img');
      var cap = node.querySelector('.cap');
      var imgId = s.heroImageIds[i];
      if (imgId) {
        cap.remove();
        img.alt = '豬仔照片 ' + (i + 1);
        Store.getImage(imgId).then(function (dataURL) {
          if (dataURL) { img.src = dataURL; img.hidden = false; node.querySelector('.doodle') && node.querySelector('.doodle').remove(); }
        });
        // doodle stays as fallback until image resolves; remove once shown above
      } else {
        cap.textContent = '豬仔照片 ' + (i + 1) + '（後台可更換）';
      }
      host.appendChild(frame);
    });
  }

  function renderSlogans() {
    var s = Store.getSettings();
    var colors = ['var(--coral)', 'var(--mint-deep)', 'var(--yolk-deep)'];
    var texts = [s.slogan1, s.slogan2, s.slogan3];
    var host = document.getElementById('slogans');
    host.replaceChildren();
    texts.forEach(function (text, i) {
      var tpl = document.getElementById('tpl-squiggle');
      var node = tpl.content.cloneNode(true);
      var svg = node.querySelector('svg');
      svg.style.color = colors[i];
      var wrap = h('div', { class: 'slogan hand' }, [text]);
      wrap.appendChild(svg);
      host.appendChild(wrap);
    });
  }

  function renderPricing() {
    var host = document.getElementById('pricing');
    host.replaceChildren();
    Store.getPlans().forEach(function (plan) {
      var children = [];
      if (plan.recommended) children.push(h('div', { class: 'badge-rec', text: '推薦' }));
      children.push(h('div', { class: 'plan', text: plan.name }));
      if (plan.desc) children.push(h('div', { class: 'desc', text: plan.desc }));
      children.push(h('div', { class: 'amt', text: Store.formatPrice(plan.price) }));
      host.appendChild(h('div', { class: 'price-card' }, children));
    });
  }

  // ---------------- album ----------------
  function renderAlbum() {
    var host = document.getElementById('albumList');
    host.replaceChildren();
    Store.getFolders().forEach(function (folder) {
      var count = Store.getPhotos(folder.id).length;
      var thumbHost = h('span', {});
      var tile = h('div', { class: 'folder', tabindex: '0', role: 'button', 'aria-label': folder.name + '，' + count + ' 張照片' }, [
        thumbHost,
        h('span', { class: 'fname', text: folder.name }),
        h('span', { class: 'fcount', text: count + ' 張照片' })
      ]);
      fillFolderThumb(thumbHost, folder.coverImageId);
      tile.addEventListener('click', function () { showFolderDetail(folder.id); });
      tile.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showFolderDetail(folder.id); } });
      host.appendChild(tile);
    });
  }
  function fillFolderThumb(host, coverImageId) {
    if (coverImageId) {
      Store.getImage(coverImageId).then(function (dataURL) {
        host.replaceChildren();
        if (dataURL) host.appendChild(h('img', { src: dataURL, alt: '' }));
      });
    } else {
      var tpl = document.getElementById('tpl-folder-icon');
      host.appendChild(tpl.content.cloneNode(true));
    }
  }

  function showFolderDetail(folderId) {
    var folder = Store.getFolders().find(function (f) { return f.id === folderId; });
    if (!folder) return;
    document.getElementById('albumList').hidden = true;
    var detail = document.getElementById('folderDetail');
    detail.hidden = false;
    document.getElementById('folderDetailName').textContent = folder.name;
    var grid = document.getElementById('folderPhotoGrid');
    grid.replaceChildren();
    var photos = Store.getPhotos(folderId);
    if (photos.length === 0) {
      grid.appendChild(h('p', { class: 'empty-note', text: '這個資料夾還沒有照片' }));
      return;
    }
    Promise.all(photos.map(function (p) { return Store.getImage(p.imageId); })).then(function (urls) {
      grid.replaceChildren();
      photos.forEach(function (p, i) {
        if (!urls[i]) return;
        var btn = h('button', { class: 'photo-thumb', type: 'button', 'aria-label': '放大檢視照片 ' + (i + 1) }, [
          h('img', { src: urls[i], alt: '' })
        ]);
        btn.addEventListener('click', function () {
          openLightbox(urls.map(function (u, j) { return { src: u, alt: folder.name + ' 照片 ' + (j + 1) }; }), i);
        });
        grid.appendChild(btn);
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.getElementById('backToAlbum');
    if (backBtn) backBtn.addEventListener('click', function () {
      document.getElementById('folderDetail').hidden = true;
      document.getElementById('albumList').hidden = false;
    });
  });

  // ---------------- lightbox ----------------
  var lbItems = [];
  var lbIndex = 0;
  function openLightbox(items, index) {
    lbItems = items;
    lbIndex = index;
    renderLightbox();
    var dialog = document.getElementById('lightbox');
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }
  function renderLightbox() {
    var item = lbItems[lbIndex];
    if (!item) return;
    var img = document.getElementById('lightboxImg');
    img.src = item.src;
    img.alt = item.alt || '';
  }
  function bindLightboxControls() {
    document.getElementById('lbPrev').addEventListener('click', function () {
      lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; renderLightbox();
    });
    document.getElementById('lbNext').addEventListener('click', function () {
      lbIndex = (lbIndex + 1) % lbItems.length; renderLightbox();
    });
    document.getElementById('lbClose').addEventListener('click', function () {
      document.getElementById('lightbox').close();
    });
  }

  // ---------------- guestbook ----------------
  var pendingPhotos = []; // {file, url}
  function renderPhotoPreviews() {
    var host = document.getElementById('msgPhotoPreviews');
    host.replaceChildren();
    pendingPhotos.forEach(function (p, i) {
      var removeBtn = h('button', { type: 'button', 'aria-label': '移除這張照片' }, ['✕']);
      removeBtn.addEventListener('click', function () {
        URL.revokeObjectURL(p.url);
        pendingPhotos.splice(i, 1);
        renderPhotoPreviews();
      });
      host.appendChild(h('div', { class: 'prev-item' }, [h('img', { src: p.url, alt: '' }), removeBtn]));
    });
    document.getElementById('msgPhotosLabel').textContent =
      pendingPhotos.length ? '已選 ' + pendingPhotos.length + ' 張' : '選擇照片（最多 3 張）';
  }
  function setFieldError(id, msg) { document.getElementById(id).textContent = msg || ''; }

  function bindGuestbookForm() {
    var input = document.getElementById('msgPhotos');
    input.addEventListener('change', function () {
      setFieldError('msgPhotosError', '');
      var files = Array.from(input.files || []);
      for (var i = 0; i < files.length; i++) {
        if (pendingPhotos.length >= 3) { setFieldError('msgPhotosError', '最多上傳 3 張照片'); break; }
        var f = files[i];
        if (f.type.indexOf('image/') !== 0) { setFieldError('msgPhotosError', '請選擇圖片檔案'); continue; }
        pendingPhotos.push({ file: f, url: URL.createObjectURL(f) });
      }
      input.value = '';
      renderPhotoPreviews();
    });

    var form = document.getElementById('msgForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setFieldError('msgNameError', '');
      setFieldError('msgTextError', '');
      var name = document.getElementById('msgName').value.trim();
      var text = document.getElementById('msgText').value.trim();
      var ok = true;
      if (!name) { setFieldError('msgNameError', '請輸入暱稱'); ok = false; }
      else if (name.length > 20) { setFieldError('msgNameError', '暱稱請在 20 字以內'); ok = false; }
      if (!text) { setFieldError('msgTextError', '請輸入留言內容'); ok = false; }
      else if (text.length > 300) { setFieldError('msgTextError', '留言請在 300 字以內'); ok = false; }
      if (!ok) return;

      var submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      Store.addMessage({ name: name, text: text }, pendingPhotos.map(function (p) { return p.file; }))
        .then(function () {
          form.reset();
          pendingPhotos.forEach(function (p) { URL.revokeObjectURL(p.url); });
          pendingPhotos = [];
          renderPhotoPreviews();
          renderMessages();
          Store.toast('留言已送出，感謝您！', 'success');
        })
        .catch(function (err) {
          setFieldError('msgPhotosError', err && err.message ? err.message : '留言送出失敗，請再試一次');
        })
        .finally(function () { submitBtn.disabled = false; });
    });
  }

  function renderMessages() {
    var host = document.getElementById('msgList');
    host.replaceChildren();
    var messages = Store.getMessages().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    messages.forEach(function (m) {
      var d = new Date(m.date);
      var dateStr = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
      var photoHost = h('div', { class: 'msg-photos' });
      var li = h('li', { class: 'msg' }, [
        h('div', { class: 'msg-head' }, [
          h('span', { class: 'msg-name', text: m.name }),
          h('span', { class: 'msg-date', text: dateStr })
        ]),
        h('p', { class: 'msg-text', text: m.text }),
        photoHost
      ]);
      if (m.photoIds && m.photoIds.length) {
        Promise.all(m.photoIds.map(function (id) { return Store.getImage(id); })).then(function (urls) {
          urls.forEach(function (url, i) {
            if (!url) return;
            var btn = h('button', { type: 'button', 'aria-label': '放大檢視照片' }, [h('img', { src: url, alt: '' })]);
            btn.addEventListener('click', function () {
              openLightbox(urls.filter(Boolean).map(function (u) { return { src: u, alt: m.name + ' 的留言照片' }; }), i);
            });
            photoHost.appendChild(btn);
          });
        });
      }
      host.appendChild(li);
    });
  }

  function buildDbFailNote() {
    return h('div', { class: 'dbfail' }, [
      h('h2', { text: '無法使用本機儲存' }),
      h('p', { text: '您的瀏覽器不支援或已停用 IndexedDB（例如隱私瀏覽模式）。此 Demo 需要瀏覽器儲存空間才能運作，請更換瀏覽器或關閉隱私瀏覽模式後再重新整理頁面。' })
    ]);
  }

  (async function init() {
    await Store.ready;
    bindBanner();
    if (Store.dbUnavailable) {
      var main = document.querySelector('main');
      main.replaceChildren(buildDbFailNote());
      return;
    }
    bindLineButtons();
    renderBrand();
    renderHero();
    renderSlogans();
    renderPricing();
    renderAlbum();
    renderMessages();
    bindGuestbookForm();
    bindLightboxControls();

    // Two-tab safety net (item 6): store.js refreshes its cache when this
    // tab regains visibility; re-render so admin-side edits made while this
    // tab was in the background show up without a manual reload.
    window.addEventListener('store:refreshed', function () {
      renderBrand();
      renderHero();
      renderSlogans();
      renderPricing();
      renderAlbum();
      renderMessages();
    });
  })();
})();

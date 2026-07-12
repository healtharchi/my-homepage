/* =====================================================================
   HEALTH ARCHI 共有ボタン部品 share.js v1.0（2026-07-12）
   ---------------------------------------------------------------------
   組み込み（2行）:
     <script src="https://healtharchi.com/share.js" defer></script>
     <button type="button" data-ha-share>共有</button>
   ・ボタンの見た目はページ側で自由（data-ha-share が目印）
   ・スマホ等 Web Share API 対応環境 → OS標準の共有シート
   ・非対応環境 → 小さなメニュー（リンクをコピー／LINEで送る）
   ・文言は「共有」だけ。誘導文言は付けない（2026-07-11方針）
   ・計測: GA4 share_click { method: web_share | copy | line }
   ===================================================================== */
(function () {
  'use strict';

  function track(method) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'share_click', { method: method, page_path: location.pathname });
      }
    } catch (e) { /* 計測失敗は無視 */ }
  }

  function pageInfo(btn) {
    var url = btn.getAttribute('data-share-url');
    if (!url) {
      var canonical = document.querySelector('link[rel="canonical"]');
      url = canonical ? canonical.href : location.href;
    }
    var title = btn.getAttribute('data-share-title') || document.title;
    return { title: title, url: url };
  }

  var openMenu = null;
  function closeMenu() {
    if (openMenu && openMenu.parentNode) openMenu.parentNode.removeChild(openMenu);
    openMenu = null;
  }

  function showMenu(btn, info) {
    closeMenu();
    var menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.style.cssText =
      'position:absolute;z-index:9999;background:#fff;border:1px solid #E8E4DE;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(14,26,47,0.14);padding:6px;min-width:200px;font-family:inherit;';

    function item(label, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText =
        'display:block;width:100%;text-align:left;background:none;border:none;cursor:pointer;' +
        'padding:12px 14px;font-size:15px;color:#2C2C2C;border-radius:8px;min-height:44px;font-family:inherit;';
      b.onmouseover = function () { b.style.background = '#FAF8F5'; };
      b.onmouseout = function () { b.style.background = 'none'; };
      b.addEventListener('click', function (e) { e.stopPropagation(); onClick(b); });
      menu.appendChild(b);
      return b;
    }

    item('リンクをコピー', function (el) {
      var done = function () {
        track('copy');
        el.textContent = 'コピーしました';
        setTimeout(closeMenu, 900);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(info.url).then(done, function () { fallbackCopy(info.url); done(); });
      } else {
        fallbackCopy(info.url); done();
      }
    });

    item('LINEで送る', function () {
      track('line');
      var u = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(info.url);
      window.open(u, '_blank', 'noopener');
      closeMenu();
    });

    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect();
    var left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - menu.offsetWidth - 12);
    menu.style.top = (r.bottom + window.scrollY + 8) + 'px';
    menu.style.left = Math.max(12 + window.scrollX, left) + 'px';
    openMenu = menu;

    setTimeout(function () {
      document.addEventListener('click', function onDoc(e) {
        if (openMenu && !openMenu.contains(e.target)) { closeMenu(); document.removeEventListener('click', onDoc); }
      });
    }, 0);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 手動コピーに委ねる */ }
    document.body.removeChild(ta);
  }

  function onShareClick(e) {
    var btn = e.target.closest && e.target.closest('[data-ha-share]');
    if (!btn) return;
    e.preventDefault();
    var info = pageInfo(btn);
    if (navigator.share) {
      navigator.share({ title: info.title, url: info.url })
        .then(function () { track('web_share'); })
        .catch(function () { /* ユーザーが閉じた場合は何もしない */ });
    } else {
      showMenu(btn, info);
    }
  }

  document.addEventListener('click', onShareClick);
})();

/**
 * HEALTH ARCHI フィードバック基盤 共通部品（P039・2026-07-03）
 * 全公開ツールに1行で組み込む：
 *   <script src="https://healtharchi.com/feedback.js" data-tool="T012_offkai-memo"></script>
 * （<body> の先頭近くに置く。defer なし＝エラー捕捉を早く始めるため）
 *
 * 機能：
 *  1. 自動エラー報告 … JSエラー・Promiseエラー・CDN等のリソース読み込み失敗を自動送信
 *     （送るのはエラー内容・ページURL・ブラウザ種別のみ。ツールに入力された業務データは送らない）
 *  2. 報告ボタン … 画面隅の「不具合・要望」ボタン → 記入フォーム → 送信
 */
(function () {
  "use strict";
  if (window.__haFeedbackLoaded) return;
  window.__haFeedbackLoaded = true;

  var script = document.currentScript;
  var TOOL_ID = (script && script.getAttribute("data-tool")) || location.hostname + location.pathname;
  var ENDPOINT =
    (script && script.getAttribute("data-endpoint")) ||
    "https://takumi-phi.vercel.app/api/feedback";
  var POSITION = (script && script.getAttribute("data-position")) === "left" ? "left" : "right";

  // ---------- 送信 ----------
  function send(payload, done) {
    payload.tool_id = TOOL_ID;
    payload.page_url = location.href.slice(0, 500);
    payload.user_agent = navigator.userAgent.slice(0, 400);
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) { if (done) done(res.ok); })
        .catch(function () { if (done) done(false); });
    } catch (e) {
      if (done) done(false);
    }
  }

  // ---------- 1. 自動エラー報告（1セッション同一エラーは1回だけ） ----------
  function alreadySent(key) {
    try {
      var k = "ha_fb_" + key;
      if (sessionStorage.getItem(k)) return true;
      sessionStorage.setItem(k, "1");
      return false;
    } catch (e) {
      return false; // sessionStorage不可でも報告はする
    }
  }

  function reportError(message, stack) {
    message = String(message || "").slice(0, 1000);
    if (!message || alreadySent(message.slice(0, 100))) return;
    send({ kind: "auto_error", error_message: message, error_stack: String(stack || "").slice(0, 4000) });
  }

  // JSエラー＋リソース読み込み失敗（capture=true でscript/link/img等の失敗も拾う）
  window.addEventListener(
    "error",
    function (event) {
      var t = event.target;
      if (t && t !== window && (t.tagName === "SCRIPT" || t.tagName === "LINK" || t.tagName === "IMG")) {
        var url = t.src || t.href || "";
        if (url) reportError("リソース読み込み失敗: " + url, "tag=" + t.tagName);
        return;
      }
      reportError(event.message, event.error && event.error.stack);
    },
    true
  );
  window.addEventListener("unhandledrejection", function (event) {
    var r = event.reason;
    reportError("未処理のPromiseエラー: " + (r && r.message ? r.message : String(r)), r && r.stack);
  });

  // ---------- 2. 報告ボタン＋フォーム ----------
  function h(tag, style, text) {
    var el = document.createElement(tag);
    if (style) el.style.cssText = style;
    if (text) el.textContent = text;
    return el;
  }

  function buildUI() {
    var FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;";

    // 開くボタン
    var btn = h(
      "button",
      FONT +
        "position:fixed;bottom:16px;" + POSITION + ":16px;z-index:99990;" +
        "background:#1B2B4B;color:#fff;border:none;border-radius:24px;" +
        "padding:10px 16px;font-size:14px;line-height:1;cursor:pointer;" +
        "box-shadow:0 2px 8px rgba(0,0,0,.25);",
      "不具合・要望"
    );
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "不具合・要望を送る");

    // モーダル（背景）
    var overlay = h(
      "div",
      "position:fixed;inset:0;z-index:99991;background:rgba(0,0,0,.5);display:none;" +
        "align-items:center;justify-content:center;padding:16px;"
    );

    var box = h(
      "div",
      FONT +
        "background:#fff;border-radius:12px;max-width:480px;width:100%;" +
        "padding:24px;box-sizing:border-box;max-height:90vh;overflow-y:auto;"
    );
    overlay.appendChild(box);

    var title = h("div", "font-size:20px;font-weight:700;color:#1B2B4B;margin-bottom:8px;", "不具合・ご要望の報告");
    var lead = h(
      "p",
      "font-size:14px;color:#555;margin:0 0 16px;line-height:1.6;",
      "お気づきの点をお送りください。ここに書いた内容と閲覧ページ情報のみが送信されます（ツールに入力したデータは送信されません）。"
    );

    var ta = h(
      "textarea",
      FONT + "width:100%;box-sizing:border-box;min-height:120px;font-size:18px;" +
        "border:1px solid #ccc;border-radius:8px;padding:12px;margin-bottom:12px;"
    );
    ta.placeholder = "例）計算ボタンを押しても反応しない／こんな機能がほしい など";
    ta.maxLength = 2000;

    var contact = h(
      "input",
      FONT + "width:100%;box-sizing:border-box;font-size:16px;height:44px;" +
        "border:1px solid #ccc;border-radius:8px;padding:0 12px;margin-bottom:4px;"
    );
    contact.type = "text";
    contact.placeholder = "連絡先（任意・返信をご希望の場合のみ）";
    contact.maxLength = 200;
    var contactNote = h("p", "font-size:12px;color:#888;margin:0 0 16px;", "メールアドレス等。未記入でも送信できます。");

    // ハニーポット（人間には見えない・botよけ）
    var hp = h("input", "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;");
    hp.type = "text";
    hp.tabIndex = -1;
    hp.setAttribute("autocomplete", "off");
    hp.setAttribute("aria-hidden", "true");

    var msg = h("p", "font-size:14px;margin:0 0 12px;display:none;");

    var row = h("div", "display:flex;gap:12px;justify-content:flex-end;");
    var cancel = h(
      "button",
      FONT + "min-height:48px;padding:0 20px;font-size:16px;border-radius:8px;cursor:pointer;" +
        "background:#fff;color:#1B2B4B;border:1px solid #1B2B4B;",
      "閉じる"
    );
    cancel.setAttribute("type", "button");
    var submit = h(
      "button",
      FONT + "min-height:48px;padding:0 24px;font-size:16px;font-weight:700;border-radius:8px;cursor:pointer;" +
        "background:#C85400;color:#fff;border:none;",
      "送信する"
    );
    submit.setAttribute("type", "button");
    row.appendChild(cancel);
    row.appendChild(submit);

    box.appendChild(title);
    box.appendChild(lead);
    box.appendChild(ta);
    box.appendChild(contact);
    box.appendChild(contactNote);
    box.appendChild(hp);
    box.appendChild(msg);
    box.appendChild(row);

    function open() {
      overlay.style.display = "flex";
      ta.focus();
    }
    function close() {
      overlay.style.display = "none";
      msg.style.display = "none";
    }

    btn.addEventListener("click", open);
    cancel.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    submit.addEventListener("click", function () {
      var text = ta.value.trim();
      if (!text) {
        msg.textContent = "報告内容を入力してください。";
        msg.style.color = "#B91C1C";
        msg.style.display = "block";
        return;
      }
      submit.disabled = true;
      submit.textContent = "送信中…";
      send(
        { kind: "user_report", message: text, contact: contact.value.trim(), website: hp.value },
        function (ok) {
          submit.disabled = false;
          submit.textContent = "送信する";
          if (ok) {
            ta.value = "";
            contact.value = "";
            msg.textContent = "報告を受け付けました。ありがとうございました。";
            msg.style.color = "#1B2B4B";
            msg.style.display = "block";
            setTimeout(close, 1800);
          } else {
            msg.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
            msg.style.color = "#B91C1C";
            msg.style.display = "block";
          }
        }
      );
    });

    document.body.appendChild(btn);
    document.body.appendChild(overlay);
  }

  if (document.body) {
    buildUI();
  } else {
    document.addEventListener("DOMContentLoaded", buildUI);
  }
})();

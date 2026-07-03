/**
 * HEALTH ARCHI サブスク解錠キット 共通部品（P040・2026-07-03）
 * どの公開ツールにも1行で組み込む：
 *   <script src="https://healtharchi.com/unlock.js" data-tool="T011_smart-quote-pro"></script>
 *
 * ツール側からの使い方（3つだけ）：
 *   HAUnlock.isPro()          … 有料機能を開けてよいか（true/false）
 *   HAUnlock.open()           … 申込・解錠・解約の窓口（モーダル）を開く
 *   HAUnlock.require(fn)      … 契約済ならfnを実行、未契約なら窓口を開く
 * 状態が変わると document に "ha-unlock-change" イベントが飛ぶ。
 *
 * 仕組み（2026-07-03方式確定・P040要件定義参照）：
 *   申込＝Stripe Payment Link ／ 解錠＝メールに6桁コード→署名付きライセンス（14日・自動更新）
 *   解約・カード変更・領収書＝Stripe顧客ポータル ／ 契約確認はサーバーが毎回Stripeへ直接照会
 */
(function () {
  "use strict";
  if (window.HAUnlock) return;

  var script = document.currentScript;
  var TOOL_ID = (script && script.getAttribute("data-tool")) || location.hostname + location.pathname;
  var API = (script && script.getAttribute("data-api")) || "https://takumi-phi.vercel.app/api/license";
  var STORE_KEY = "ha_license";
  var REFRESH_BEFORE_SECONDS = 7 * 24 * 60 * 60; // 期限7日前から静かに更新を試みる

  var FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;";

  // ---------- ライセンスの保存・読み出し ----------
  function decodePayload(token) {
    try {
      var body = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(body))));
    } catch (e) {
      return null;
    }
  }
  function getStored() {
    try {
      var token = localStorage.getItem(STORE_KEY);
      if (!token) return null;
      var p = decodePayload(token);
      if (!p || !p.exp) return null;
      return { token: token, payload: p };
    } catch (e) {
      return null;
    }
  }
  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }
  function isValid(stored) {
    return !!(stored && stored.payload.exp > nowSec());
  }
  function saveToken(token) {
    try {
      localStorage.setItem(STORE_KEY, token);
    } catch (e) {}
    fireChange();
  }
  function clearToken() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {}
    fireChange();
  }
  function fireChange() {
    try {
      document.dispatchEvent(new CustomEvent("ha-unlock-change", { detail: { pro: api.isPro() } }));
    } catch (e) {}
  }

  // ---------- API呼び出し ----------
  function post(path, body, done) {
    fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) { done(res.ok, data); });
      })
      .catch(function () { done(false, { error: "通信に失敗しました。電波状況をご確認ください。" }); });
  }

  var configCache = null;
  function loadConfig(done) {
    if (configCache) return done(configCache);
    fetch(API + "/config")
      .then(function (res) { return res.json(); })
      .then(function (data) { configCache = data; done(data); })
      .catch(function () { done(null); });
  }

  // ---------- 静かな自動更新（再ログイン不要・解約なら施錠） ----------
  function silentRefresh() {
    var stored = getStored();
    if (!stored) return;
    var remaining = stored.payload.exp - nowSec();
    if (remaining > REFRESH_BEFORE_SECONDS) return; // まだ新しい
    if (!navigator.onLine) return; // オフライン猶予（期限まで使える）
    post("/refresh", { token: stored.token }, function (ok, data) {
      if (ok && data.ok && data.active && data.token) {
        saveToken(data.token);
      } else if (ok && data.ok && data.active === false) {
        clearToken(); // 解約済み＝施錠
      }
      // 通信・サーバー障害時は何もしない（期限までは使える＝14日猶予）
    });
  }

  // ---------- UI部品 ----------
  function h(tag, style, text) {
    var el = document.createElement(tag);
    if (style) el.style.cssText = FONT + style;
    if (text) el.textContent = text;
    return el;
  }
  function button(label, primary) {
    var b = h(
      "button",
      "min-height:48px;padding:0 20px;font-size:16px;font-weight:700;border-radius:8px;cursor:pointer;width:100%;box-sizing:border-box;margin-bottom:10px;" +
        (primary
          ? "background:#C85400;color:#fff;border:none;"
          : "background:#fff;color:#1B2B4B;border:1px solid #1B2B4B;")
    );
    b.textContent = label;
    b.setAttribute("type", "button");
    return b;
  }
  function input(placeholder, type) {
    var i = h(
      "input",
      "width:100%;box-sizing:border-box;font-size:18px;height:48px;border:1px solid #ccc;border-radius:8px;padding:0 12px;margin-bottom:10px;"
    );
    i.type = type || "text";
    i.placeholder = placeholder;
    return i;
  }

  var overlay = null;
  var box = null;

  function ensureModal() {
    if (overlay) return;
    overlay = h("div", "position:fixed;inset:0;z-index:99992;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:16px;");
    box = h("div", "background:#fff;border-radius:12px;max-width:440px;width:100%;padding:24px;box-sizing:border-box;max-height:90vh;overflow-y:auto;");
    overlay.appendChild(box);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }
  function openModal() {
    ensureModal();
    render();
    overlay.style.display = "flex";
  }
  function closeModal() {
    if (overlay) overlay.style.display = "none";
  }

  function header(titleText) {
    var wrap = h("div", "margin-bottom:12px;");
    var title = h("div", "font-size:20px;font-weight:700;color:#1B2B4B;", titleText);
    wrap.appendChild(title);
    loadConfig(function (cfg) {
      if (cfg && cfg.testMode) {
        var badge = h("span", "display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#B91C1C;border:1px solid #B91C1C;border-radius:4px;padding:2px 8px;", "テストモード（実際の請求は発生しません）");
        wrap.appendChild(badge);
      }
    });
    return wrap;
  }
  function note(text, isError) {
    var p = h("p", "font-size:14px;line-height:1.6;margin:0 0 12px;" + (isError ? "color:#B91C1C;" : "color:#555;"), text);
    return p;
  }
  function closeRow() {
    var c = h("button", "min-height:44px;padding:0 16px;font-size:14px;border:none;background:none;color:#555;cursor:pointer;text-decoration:underline;display:block;margin:4px auto 0;", "閉じる");
    c.setAttribute("type", "button");
    c.addEventListener("click", closeModal);
    return c;
  }

  // ---------- 画面1：未契約（申込＋解錠） ----------
  function renderLocked() {
    box.textContent = "";
    box.appendChild(header("有料機能のご利用"));
    box.appendChild(note("この機能はご契約者さま向けです。お申し込み後、メールアドレスだけで解錠できます（アカウント登録・パスワード不要）。"));

    var planArea = h("div", "");
    box.appendChild(planArea);
    loadConfig(function (cfg) {
      if (!cfg || !cfg.plans || !cfg.plans.length) {
        planArea.appendChild(note("申込ページの準備中です。しばらくお待ちください。", true));
        return;
      }
      cfg.plans.forEach(function (plan) {
        var card = h("div", "border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:10px;");
        card.appendChild(h("div", "font-size:16px;font-weight:700;color:#1B2B4B;margin-bottom:2px;", plan.name));
        card.appendChild(h("div", "font-size:14px;color:#555;margin-bottom:10px;", plan.priceLabel + "・いつでも解約できます"));
        var buy = button(plan.name + "に申し込む", true);
        buy.style.marginBottom = "0";
        buy.addEventListener("click", function () {
          location.href = plan.url;
        });
        card.appendChild(buy);
        planArea.appendChild(card);
      });
    });

    box.appendChild(h("div", "border-top:1px solid #eee;margin:14px 0;"));
    box.appendChild(note("すでにご契約の方（別の端末で使う方も）はこちらから解錠できます。"));

    var email = input("お申し込み時のメールアドレス", "email");
    var msg = note("", true);
    msg.style.display = "none";
    var sendBtn = button("解錠コードをメールで受け取る", false);
    var codeArea = h("div", "display:none;");
    var code = input("メールに届いた6桁のコード");
    code.inputMode = "numeric";
    code.maxLength = 6;
    var unlockBtn = button("解錠する", true);
    codeArea.appendChild(code);
    codeArea.appendChild(unlockBtn);

    function showMsg(text, isError) {
      msg.textContent = text;
      msg.style.color = isError ? "#B91C1C" : "#1B2B4B";
      msg.style.display = "block";
    }

    sendBtn.addEventListener("click", function () {
      var v = email.value.trim();
      if (!v) return showMsg("メールアドレスを入力してください。", true);
      sendBtn.disabled = true;
      sendBtn.textContent = "送信中…";
      post("/send-code", { email: v }, function (ok, data) {
        sendBtn.disabled = false;
        sendBtn.textContent = "解錠コードをメールで受け取る";
        if (ok && data.ok) {
          codeArea.style.display = "block";
          showMsg("コードを送信しました。メールをご確認ください（届くまで1分ほどかかることがあります）。", false);
          code.focus();
        } else {
          showMsg((data && data.error) || "送信に失敗しました。", true);
        }
      });
    });

    unlockBtn.addEventListener("click", function () {
      var v = code.value.trim();
      if (!/^\d{6}$/.test(v)) return showMsg("6桁のコードを入力してください。", true);
      unlockBtn.disabled = true;
      unlockBtn.textContent = "確認中…";
      post("/verify-code", { email: email.value.trim(), code: v }, function (ok, data) {
        unlockBtn.disabled = false;
        unlockBtn.textContent = "解錠する";
        if (ok && data.ok && data.token) {
          saveToken(data.token);
          render(); // 契約中画面へ
        } else {
          showMsg((data && data.error) || "解錠に失敗しました。", true);
        }
      });
    });

    box.appendChild(email);
    box.appendChild(sendBtn);
    box.appendChild(codeArea);
    box.appendChild(msg);
    box.appendChild(closeRow());
  }

  // ---------- 画面2：契約中（管理） ----------
  function renderUnlocked(stored) {
    box.textContent = "";
    box.appendChild(header("ご契約中"));
    var planName = stored.payload.plan === "hojin" ? "法人スタンダード" : "個人ライト";
    box.appendChild(note("プラン：" + planName + "\n登録メール：" + stored.payload.email));
    box.appendChild(note("この端末では有料機能が使えます。"));

    var msg = note("", true);
    msg.style.display = "none";

    var portal = button("お支払い・解約の管理（安全なStripeのページが開きます）", true);
    portal.addEventListener("click", function () {
      portal.disabled = true;
      portal.textContent = "ページを準備中…";
      post("/portal", { token: stored.token, returnUrl: location.href }, function (ok, data) {
        portal.disabled = false;
        portal.textContent = "お支払い・解約の管理（安全なStripeのページが開きます）";
        if (ok && data.ok && data.url) {
          location.href = data.url;
        } else {
          msg.textContent = (data && data.error) || "ページを開けませんでした。";
          msg.style.display = "block";
        }
      });
    });
    box.appendChild(portal);

    var release = h("button", "min-height:44px;font-size:14px;border:none;background:none;color:#B91C1C;cursor:pointer;text-decoration:underline;display:block;margin:0 auto;", "この端末の解錠を解除する（解約ではありません）");
    release.setAttribute("type", "button");
    release.addEventListener("click", function () {
      if (window.confirm("この端末の解錠を解除しますか？（ご契約は続きます。メールのコードでまた解錠できます）")) {
        clearToken();
        render();
      }
    });
    box.appendChild(release);
    box.appendChild(msg);
    box.appendChild(closeRow());
  }

  function render() {
    var stored = getStored();
    if (isValid(stored)) {
      renderUnlocked(stored);
    } else {
      renderLocked();
    }
  }

  // ---------- 公開API ----------
  var api = {
    toolId: TOOL_ID,
    isPro: function () {
      return isValid(getStored());
    },
    plan: function () {
      var s = getStored();
      return isValid(s) ? s.payload.plan : null;
    },
    email: function () {
      var s = getStored();
      return isValid(s) ? s.payload.email : null;
    },
    open: function () {
      openModal();
    },
    require: function (fn) {
      if (api.isPro()) {
        fn();
      } else {
        openModal();
      }
    },
    clear: clearToken,
  };
  window.HAUnlock = api;

  // 起動時：期限が近ければ静かに更新
  if (document.body) {
    silentRefresh();
  } else {
    document.addEventListener("DOMContentLoaded", silentRefresh);
  }
})();

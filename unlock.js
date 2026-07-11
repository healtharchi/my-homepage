/**
 * HEALTH ARCHI サブスク共通部品（P040・2026-07-04 v1.1 文言全面改訂）
 * どの公開ツールにも1行で組み込む：
 *   <script src="https://healtharchi.com/unlock.js" data-tool="T011_smart-quote-pro"></script>
 *
 * 利用者に見える言葉は世界標準（Claude/ChatGPT等と同じ）に合わせる：
 *   パスワードなし。「メールアドレス → 届いた8桁の確認コード → ログイン」の2ステップ。
 *
 * ツール側からの使い方（3つだけ）：
 *   HAUnlock.isPro()          … 有料機能を使える状態か（true/false）
 *   HAUnlock.open()           … プラン申込・ログイン・解約の画面を開く（open("login")でログイン画面から）
 *   HAUnlock.require(fn)      … ログイン済ならfnを実行、未ログインなら画面を開く
 * 状態が変わると document に "ha-unlock-change" イベントが飛ぶ。
 *
 * 仕組み（P040要件定義参照）：申込＝Stripe Payment Link／ログイン＝メールOTP→署名付きライセンス
 * （14日・自動更新・オフライン猶予）／解約等＝Stripe顧客ポータル／契約確認はサーバーがStripeへ直接照会
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

  // ---------- 静かな自動更新（再ログイン不要・解約なら期限で自動ログアウト） ----------
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
        clearToken(); // 契約終了
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
  function textLink(label) {
    var a = h("button", "min-height:44px;font-size:14px;border:none;background:none;color:#1B2B4B;cursor:pointer;text-decoration:underline;display:block;margin:0 auto;", label);
    a.setAttribute("type", "button");
    return a;
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
  function note(text, isError) {
    return h("p", "font-size:14px;line-height:1.6;margin:0 0 12px;white-space:pre-line;" + (isError ? "color:#B91C1C;" : "color:#555;"), text);
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
  function openModal(view) {
    ensureModal();
    render(view);
    overlay.style.display = "flex";
  }
  function closeModal() {
    if (overlay) overlay.style.display = "none";
  }

  function header(titleText) {
    var wrap = h("div", "margin-bottom:12px;");
    wrap.appendChild(h("div", "font-size:20px;font-weight:700;color:#1B2B4B;", titleText));
    loadConfig(function (cfg) {
      if (cfg && cfg.testMode) {
        wrap.appendChild(h("span", "display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#B91C1C;border:1px solid #B91C1C;border-radius:4px;padding:2px 8px;", "テストモード（実際の請求は発生しません）"));
      }
    });
    return wrap;
  }
  function closeRow() {
    var c = h("button", "min-height:44px;padding:0 16px;font-size:14px;border:none;background:none;color:#555;cursor:pointer;text-decoration:underline;display:block;margin:4px auto 0;", "閉じる");
    c.setAttribute("type", "button");
    c.addEventListener("click", closeModal);
    return c;
  }

  // ---------- 画面1：プラン（未契約の方向け） ----------
  function renderPlans() {
    box.textContent = "";
    box.appendChild(header("プランのご案内"));

    var loginLead = h("div", "background:#f4f6fa;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px;color:#1B2B4B;");
    loginLead.appendChild(document.createTextNode("すでにお申し込み済みの方は "));
    var loginLink = h("button", "font-size:14px;font-weight:700;border:none;background:none;color:#C85400;cursor:pointer;text-decoration:underline;padding:0;", "ログイン");
    loginLink.setAttribute("type", "button");
    loginLink.addEventListener("click", function () { renderLogin(""); });
    loginLead.appendChild(loginLink);
    box.appendChild(loginLead);

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
      planArea.appendChild(note("お申し込み後は、登録したメールアドレスでログインするだけで使えます（パスワードは不要です）。"));
    });

    box.appendChild(closeRow());
  }

  // ---------- 画面2：ログイン（メールアドレス入力） ----------
  function renderLogin(presetEmail, leadText) {
    box.textContent = "";
    box.appendChild(header("ログイン"));
    box.appendChild(note(leadText || "お申し込み時のメールアドレスを入力してください。ログイン用の確認コード（8桁）をお送りします。パスワードは不要です。"));

    var email = input("メールアドレス", "email");
    if (presetEmail) email.value = presetEmail;
    var msg = note("", true);
    msg.style.display = "none";
    var sendBtn = button("確認コードを送る", true);

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
        sendBtn.textContent = "確認コードを送る";
        if (ok && data.ok) {
          renderCode(v); // 次のステップへ（コード入力画面）
        } else {
          showMsg((data && data.error) || "送信に失敗しました。", true);
        }
      });
    });
    email.addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendBtn.click();
    });

    box.appendChild(email);
    box.appendChild(sendBtn);
    box.appendChild(msg);

    var toPlans = textLink("まだお申し込みでない方はこちら（プランを見る）");
    toPlans.addEventListener("click", renderPlans);
    box.appendChild(toPlans);
    box.appendChild(closeRow());
  }

  // ---------- 画面3：確認コード入力 ----------
  function renderCode(email) {
    box.textContent = "";
    box.appendChild(header("確認コードの入力"));
    box.appendChild(note(email + " 宛にログイン用の確認コード（8桁）をお送りしました。\nメールに届いた8桁の数字を、下の枠に入力してください。"));

    var code = input("8桁の数字（例：12345678）");
    code.inputMode = "numeric";
    code.maxLength = 8;
    code.style.textAlign = "center";
    code.style.fontSize = "24px";
    code.style.letterSpacing = "6px";
    var msg = note("", true);
    msg.style.display = "none";
    var loginBtn = button("ログイン", true);

    function showMsg(text) {
      msg.textContent = text;
      msg.style.display = "block";
    }

    loginBtn.addEventListener("click", function () {
      var v = code.value.trim();
      if (!/^\d{8}$/.test(v)) return showMsg("メールに届いた8桁の数字を入力してください。");
      loginBtn.disabled = true;
      loginBtn.textContent = "確認中…";
      post("/verify-code", { email: email, code: v }, function (ok, data) {
        loginBtn.disabled = false;
        loginBtn.textContent = "ログイン";
        if (ok && data.ok && data.token) {
          saveToken(data.token);
          renderAccount(); // ログイン完了画面へ
        } else {
          showMsg((data && data.error) || "ログインに失敗しました。");
        }
      });
    });
    code.addEventListener("keydown", function (e) {
      if (e.key === "Enter") loginBtn.click();
    });

    box.appendChild(code);
    box.appendChild(loginBtn);
    box.appendChild(msg);
    box.appendChild(note("メールが届かない時は、迷惑メールフォルダをご確認ください（差出人：noreply@send.healtharchi.com）。コードの有効時間は約10分です。"));

    var resend = textLink("コードを再送する／メールアドレスを入れ直す");
    resend.addEventListener("click", function () { renderLogin(email); });
    box.appendChild(resend);
    box.appendChild(closeRow());
    setTimeout(function () { code.focus(); }, 50);
  }

  // ---------- 画面4：ログイン中（アカウント） ----------
  function renderAccount() {
    var stored = getStored();
    if (!isValid(stored)) return renderPlans();
    box.textContent = "";
    box.appendChild(header("ログイン中"));
    var planName = stored.payload.plan === "hojin" ? "法人スタンダード" : "個人ライト";
    box.appendChild(note("プラン：" + planName + "\nメールアドレス：" + stored.payload.email + "\nこの端末で有料機能が使えます。"));

    var msg = note("", true);
    msg.style.display = "none";

    var portal = button("お支払い・解約の管理", true);
    portal.addEventListener("click", function () {
      portal.disabled = true;
      portal.textContent = "ページを準備中…";
      post("/portal", { token: stored.token, returnUrl: location.href }, function (ok, data) {
        portal.disabled = false;
        portal.textContent = "お支払い・解約の管理";
        if (ok && data.ok && data.url) {
          location.href = data.url;
        } else {
          msg.textContent = (data && data.error) || "ページを開けませんでした。";
          msg.style.display = "block";
        }
      });
    });
    box.appendChild(portal);
    box.appendChild(note("カードの変更・領収書の確認・解約は、上のボタンから安全なStripe（決済会社）のページで行えます。"));

    var logout = h("button", "min-height:44px;font-size:14px;border:none;background:none;color:#B91C1C;cursor:pointer;text-decoration:underline;display:block;margin:0 auto;", "ログアウト（解約ではありません）");
    logout.setAttribute("type", "button");
    logout.addEventListener("click", function () {
      if (window.confirm("この端末からログアウトしますか？\n（ご契約は続きます。メールアドレスでいつでもログインし直せます）")) {
        clearToken();
        renderLogin(stored.payload.email);
      }
    });
    box.appendChild(logout);
    box.appendChild(msg);
    box.appendChild(closeRow());
  }

  function render(view) {
    if (isValid(getStored())) return renderAccount();
    if (view === "login") return renderLogin("");
    renderPlans();
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
    open: function (view) {
      openModal(view);
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

  // 起動時：期限が近ければ静かに更新／申込直後（?subscribed=1で戻ってきた時）はログイン画面を自動で開く
  function boot() {
    silentRefresh();
    try {
      if (/[?&]subscribed=1/.test(location.search) && !api.isPro()) {
        openModal("login");
      }
    } catch (e) {}
  }
  if (document.body) {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();

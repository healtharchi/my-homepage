// P049 工務店の困りごとマップ：mondai-map-data.json → mondai-map.html を生成する
// 使い方： node build-mondai-map.mjs  （このフォルダで実行）
// ルール：mondai-map.html は直接編集しない（このスクリプトの出力が正）。内容の変更は JSON 側で行う。
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./mondai-map-data.json", import.meta.url), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LINE_URL = "https://line.me/R/ti/p/@045hrvke";
const totalCount = data.roles.reduce((n, r) => n + r.items.length, 0);

const solCard = (key) => {
  const t = data.tools[key];
  if (!t) throw new Error(`未定義の解決策キー: ${key}`);
  const ext = t.url.startsWith("http");
  return `<a class="sol" href="${esc(t.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}><span class="sol-name">${esc(t.name)}</span><span class="sol-desc">${esc(t.desc)}</span><span class="sol-go">見てみる →</span></a>`;
};

const itemHtml = (item) => {
  const sols = (item.sol || []).map(solCard).join("");
  const body = sols
    ? `<div class="sols">${sols}</div>`
    : `<p class="prep">この悩みに合うツール・記事は、いま準備を進めています。<br>「先に知りたい」と<a href="${LINE_URL}" target="_blank" rel="noopener">LINEでひと言</a>いただければ、優先してお作りします。</p>`;
  return `<details class="item"><summary>${esc(item.p)}</summary><div class="item-body"><p class="honne">${esc(item.h)}</p>${body}</div></details>`;
};

const roleNav = data.roles
  .map((r) => `<a href="#${r.id}">${esc(r.label)}<span class="cnt">${r.items.length}</span></a>`)
  .join("");

const sections = data.roles
  .map(
    (r) => `
  <section class="role" id="${r.id}">
    <h2>${esc(r.label)}<span class="role-cnt">${r.items.length}の悩み</span></h2>
    <p class="role-intro">${esc(r.intro)}</p>
    ${r.items.map(itemHtml).join("\n    ")}
  </section>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-MJTX97M6NY"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-MJTX97M6NY');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>工務店の困りごとマップ（${totalCount}の悩みと解決の道）｜HEALTH ARCHI</title>
  <meta name="description" content="見積が終わらない、言った言わないで揉める、写真整理が夜の仕事になる。工務店・建設会社で本当に起きる${totalCount}の悩みを、社長・営業・事務・経理・設計・現場管理・職人の立場別に整理し、それぞれの解決の道を示した地図です。一級建築士・建設業17年の実務と調査から。">
  <link rel="canonical" href="https://healtharchi.com/mondai-map">
  <meta property="og:site_name" content="HEALTH ARCHI">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://healtharchi.com/mondai-map">
  <meta property="og:title" content="工務店の困りごとマップ（${totalCount}の悩みと解決の道）">
  <meta property="og:description" content="工務店で本当に起きる悩みを立場別に整理し、解決の道を示した地図。建設業17年の実務と調査から。">
  <meta property="og:image" content="https://healtharchi.com/ogp.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --navy: #1B2B4B; --navy-deep: #0E1A2F; --copper: #B5703A; --copper-lt: #D4925A;
      --copper-dk: #8A5228; --charcoal: #2C2C2C; --stone: #7A7875;
      --cream: #F0EDE8; --silk: #FAF8F5; --white: #FFFFFF; --border: #E8E4DE;
      --line-green: #06C755;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Noto Sans JP', sans-serif; color: var(--charcoal); background: var(--white); line-height: 2.0; font-size: 17px; -webkit-font-smoothing: antialiased; }
    h1, h2, h3 { font-family: 'Noto Serif JP', serif; line-height: 1.5; color: var(--navy); }
    a { text-decoration: none; color: inherit; }
    .container { max-width: 820px; margin: 0 auto; padding: 0 24px; }
    .nav { background: var(--navy-deep); padding: 14px 0; }
    .nav-inner { max-width: 1080px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
    .nav-logo { color: #fff; font-family: 'Noto Serif JP', serif; font-weight: 700; letter-spacing: 0.1em; font-size: 1.05rem; }
    .nav-logo span { color: var(--copper-lt); }
    .nav-links { display: flex; gap: 20px; align-items: center; font-size: 0.85rem; }
    .nav-links a { color: rgba(255,255,255,0.75); }
    .nav-links a:hover { color: #fff; }
    .hero { background: linear-gradient(160deg, var(--navy-deep), var(--navy)); color: #fff; padding: 60px 0 52px; }
    .hero .eyebrow { color: var(--copper-lt); font-size: 0.8rem; letter-spacing: 0.16em; margin-bottom: 16px; }
    .hero h1 { color: #fff; font-size: clamp(1.5rem, 4.2vw, 2.1rem); margin-bottom: 20px; }
    .hero p { color: rgba(255,255,255,0.82); font-size: 1rem; }
    .rolenav { position: sticky; top: 0; z-index: 10; background: var(--white); border-bottom: 1px solid var(--border); overflow-x: auto; }
    .rolenav-inner { max-width: 820px; margin: 0 auto; padding: 0 16px; display: flex; gap: 4px; white-space: nowrap; }
    .rolenav a { display: inline-block; padding: 12px 12px; font-size: 0.88rem; font-weight: 500; color: var(--stone); border-bottom: 3px solid transparent; min-height: 48px; }
    .rolenav a:hover { color: var(--navy); border-bottom-color: var(--cream); }
    .rolenav .cnt { font-size: 0.72rem; color: var(--copper-dk); margin-left: 3px; }
    main { padding: 40px 0 24px; }
    .lead { margin-bottom: 12px; }
    .lead p { margin-bottom: 1.1em; }
    .role { padding-top: 26px; }
    .role h2 { font-size: 1.35rem; margin: 30px 0 8px; padding-bottom: 10px; border-bottom: 2px solid var(--cream); }
    .role-cnt { font-family: 'Noto Sans JP', sans-serif; font-size: 0.78rem; color: var(--stone); font-weight: 400; margin-left: 12px; }
    .role-intro { color: var(--stone); font-size: 0.95rem; margin-bottom: 18px; }
    .item { border: 1px solid var(--border); border-radius: 10px; background: var(--white); margin-bottom: 10px; overflow: hidden; }
    .item summary { list-style: none; cursor: pointer; padding: 15px 44px 15px 20px; font-weight: 500; line-height: 1.7; position: relative; min-height: 48px; }
    .item summary::-webkit-details-marker { display: none; }
    .item summary::after { content: ""; position: absolute; right: 18px; top: 50%; width: 10px; height: 10px; border-right: 2px solid var(--copper); border-bottom: 2px solid var(--copper); transform: translateY(-70%) rotate(45deg); transition: transform .2s; }
    .item[open] summary::after { transform: translateY(-30%) rotate(225deg); }
    .item[open] summary { background: var(--silk); }
    .item summary:hover { background: var(--silk); }
    .item-body { padding: 4px 20px 18px; border-top: 1px solid var(--border); }
    .honne { color: var(--stone); font-size: 0.92rem; margin: 12px 0 8px; padding-left: 14px; border-left: 3px solid var(--cream); }
    .sols { display: grid; gap: 10px; margin-top: 10px; }
    .sol { display: block; border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; background: var(--silk); transition: border-color .2s; }
    .sol:hover { border-color: var(--copper); }
    .sol-name { display: block; font-weight: 700; color: var(--navy); font-size: 0.98rem; }
    .sol-desc { display: block; font-size: 0.85rem; color: var(--stone); }
    .sol-go { display: block; margin-top: 4px; font-size: 0.8rem; font-weight: 700; color: var(--copper); }
    .prep { font-size: 0.92rem; color: var(--charcoal); background: var(--silk); border-radius: 10px; padding: 14px 18px; margin-top: 10px; }
    .prep a { color: var(--copper-dk); font-weight: 700; text-decoration: underline; }
    .line-cta { background: var(--navy); border-radius: 14px; padding: 36px 28px; margin: 48px 0; text-align: center; color: #fff; }
    .line-cta h2 { color: #fff; border: none; margin: 0 0 10px; font-size: 1.2rem; }
    .line-cta p { color: rgba(255,255,255,0.78); font-size: 0.9rem; margin-bottom: 20px; }
    .btn-line { display: inline-block; background: var(--line-green); color: #fff; font-weight: 700; padding: 15px 34px; border-radius: 999px; font-size: 1rem; min-height: 48px; }
    .btn-line:hover { opacity: 0.9; }
    .related { border-top: 1px solid var(--border); padding: 32px 0 8px; }
    .related h2 { font-size: 1.05rem; border: none; margin: 0 0 14px; }
    .related a { display: block; color: var(--copper-dk); font-weight: 500; margin-bottom: 8px; font-size: 0.95rem; }
    .related a:hover { text-decoration: underline; }
    .footer { background: var(--navy-deep); color: rgba(255,255,255,0.6); text-align: center; padding: 36px 0; margin-top: 56px; font-size: 0.8rem; }
    .footer a { color: rgba(255,255,255,0.85); }
    @media (max-width: 640px) { body { font-size: 16px; } .nav-links { gap: 12px; font-size: 0.78rem; } }
  </style>
</head>
<body>

  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">HEALTH <span>ARCHI</span></a>
      <div class="nav-links">
        <a href="/tools">無料ツール一覧</a>
        <a href="${LINE_URL}" target="_blank" rel="noopener">LINE登録</a>
      </div>
    </div>
  </nav>

  <header class="hero">
    <div class="container">
      <div class="eyebrow">立場別・${totalCount}の悩みと解決の道</div>
      <h1>工務店の困りごとマップ</h1>
      <p>見積が終わらない。言った言わないで揉める。写真整理が夜の仕事になる。<br>工務店・建設会社で本当に起きる悩みを、一級建築士・建設業17年の実務と調査から立場別に集めました。自分の悩みを見つけたら、開いてみてください。解決の道を添えています。</p>
    </div>
  </header>

  <div class="rolenav"><div class="rolenav-inner">${roleNav}</div></div>

  <main>
    <div class="container">
      <div class="lead">
        <p>このページは売り込みのための一覧ではありません。「この悩みは自分だけではなかった」と分かるだけでも、次の一歩は軽くなります。解決の道がまだ用意できていない悩みには、正直に「準備中」と書いています。</p>
      </div>
${sections}

      <div class="line-cta">
        <h2>あなたの悩みが、ここに無かったら</h2>
        <p>LINEでひと言お寄せください。このマップは、届いた悩みから順に育てていきます。<br>建設業で使えるAI活用と無料ツールの更新情報も、週1目安でお届けします。登録無料・いつでも解除できます。</p>
        <a class="btn-line" href="${LINE_URL}" target="_blank" rel="noopener">LINEでひと言送る</a>
      </div>

      <section class="related">
        <h2>あわせて使う</h2>
        <a href="/diagnosis">無料診断：7つの質問で、自分の会社の詰まりどころを特定する → </a>
        <a href="/tools">無料ツール一覧：登録不要・ブラウザだけで動く現場ツール → </a>
      </section>

    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p><a href="/">HEALTH ARCHI トップへ</a>　｜　<a href="/tools">無料ツール一覧</a></p>
      <p style="margin-top:10px;">© 2026 HEALTH ARCHI. All rights reserved.</p>
    </div>
  </footer>

<script>
/* HEALTH ARCHI: LINE誘導クリックを計測（キーイベント候補 line_click） */
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a[href*="line.me"]');
  if(a && typeof gtag === 'function'){ gtag('event','line_click'); }
}, true);
</script>
<script src="https://healtharchi.com/feedback.js" data-tool="mondai-map"></script>
</body>
</html>
`;

writeFileSync(new URL("./mondai-map.html", import.meta.url), html, "utf8");
console.log(`mondai-map.html を生成しました（役割 ${data.roles.length}・悩み ${totalCount}件）`);

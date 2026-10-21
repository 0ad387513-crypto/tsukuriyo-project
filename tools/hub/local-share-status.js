"use strict";
// Local-only status. No credentials, publish endpoints or buttons are exposed to members.
(() => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
  const heading = document.querySelector("main h1");
  if (!heading) return;
  const box = document.createElement("p");
  box.className = "muted";
  box.setAttribute("role", "status");
  heading.closest(".row").after(box);
  const labels = {watching:"待機中", waiting:"保存を確認中", testing:"テスト中", deploying:"公開中", published:"反映済み", pending:"公開待ち", stopped:"停止中", error:"停止・要確認"};
  async function update() {
    try {
      const r = await fetch("/output/dashboard-share/status.json", {cache:"no-store"});
      if (!r.ok) throw Error("not running");
      const data = await r.json();
      const alive = Date.now() - Date.parse(data.heartbeatAt || data.at) < 45000;
      box.replaceChildren(document.createTextNode("共有用への自動反映：" + (alive ? labels[data.state] || "確認中" : "停止中") + (data.version ? "（v" + data.version + "）" : "")));
      if (alive && data.message) box.append(document.createTextNode("　" + data.message));
      const link = document.createElement("a");
      link.href = "https://deploy-preview-2--tsukuriyo-online.netlify.app/tools/hub/";
      link.target = "_blank"; link.rel = "noopener"; link.textContent = "共有用を開く";
      box.append(document.createTextNode("　"), link);
    } catch { box.textContent = "共有用への自動反映：停止中"; }
  }
  update();
  setInterval(() => { if (!document.hidden) update(); }, 5000);
})();

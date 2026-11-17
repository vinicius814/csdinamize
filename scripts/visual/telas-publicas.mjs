import { chromium } from "playwright-core";
const vps = [["1920x1080",1920,1080],["1440x900",1440,900],["1366x768",1366,768],["tablet",820,1180],["390",390,844]];
const pages = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const p of pages) for (const [n,w,h] of vps) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto("http://127.0.0.1:5173" + p, { waitUntil: "networkidle", timeout: 60000 }).catch(()=>{});
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, munin: /Munin|Wojtec/.test(document.body.innerText + document.title), title: document.title }));
  const nome = p.replace(/\W/g,"_") + "-" + n;
  await pg.screenshot({ path: `./capturas/${nome}.png` });
  console.log(nome, "overflowX=" + (r.sw > r.cw), "munin=" + r.munin, r.title);
  await pg.close();
}
await b.close();

"use strict";
const TARGETS=Object.freeze({
  "version.js":"version.js", "index.html":"index.html", "field_card_frames.js":"field_card_frames.js",
  "field_card_frames.css":"field_card_frames.css", "field_card_art.js":"field_card_art.js",
  "release-history.json":"tools/hub/release-history.json",
});
async function productionProxy(req,res,pathname,fetcher=fetch) {
  if(!pathname.startsWith("/__production/")) return false;
  const file=pathname.slice("/__production/".length);
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,{Allow:"GET, HEAD"}).end();return true;}
  const stylesheet=/^styles\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.css$/.test(file);
  if(!Object.hasOwn(TARGETS,file)&&!stylesheet){res.writeHead(404).end();return true;}
  try {
    const target=stylesheet?file.slice("styles/".length):TARGETS[file];
    const upstream=await fetcher("https://tsukuriyo-online.netlify.app/"+target+"?dashboard="+Date.now(),{
      method:req.method,redirect:"error",signal:AbortSignal.timeout(20000),
    });
    res.writeHead(upstream.status,{"Content-Type":upstream.headers.get("content-type")||"text/plain; charset=utf-8","Cache-Control":"no-store"});
    res.end(req.method==="HEAD"?undefined:Buffer.from(await upstream.arrayBuffer()));
  } catch {res.writeHead(502,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}).end("本番の公開情報を取得できません");}
  return true;
}
module.exports={productionProxy,TARGETS};

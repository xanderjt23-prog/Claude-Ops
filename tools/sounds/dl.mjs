// downloads source media (audio files directly, videos via smallest transcode) + license metadata
import fs from 'fs';
const UA='FrontlineOpsLocalBuild/1.0 (personal hobby project)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=process.argv[2];
const files=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const strip=s=>(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
async function get(u){for(let i=0;i<6;i++){const r=await fetch(u,{headers:{'User-Agent':UA}});const t=await r.text();if(t.startsWith('{'))return JSON.parse(t);await sleep(8000*(i+1));}}
const meta={};
for(const [key,title] of Object.entries(files)){
  if(fs.existsSync(`${out}/${key}.json`)){continue;}
  const j=await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=videoinfo&viprop=url|extmetadata|derivatives|size|mime&titles=${encodeURIComponent('File:'+title)}`);
  const p=Object.values(j.query.pages)[0], vi=p.videoinfo?.[0];
  if(!vi){console.log(key,'MISSING');continue;}
  let url=vi.url;
  if(/^video/.test(vi.mime)){ // smallest derivative that is a video transcode (has audio)
    const d=(vi.derivatives||[]).filter(x=>/webm|ogv|mp4/.test(x.type||'') && x.height).sort((a,b)=>a.height-b.height);
    if(d.length) url=d[0].src;
  }
  let buf; for(let k=0;k<6;k++){const rr=await fetch(url,{headers:{'User-Agent':UA}}); if(rr.ok){buf=Buffer.from(await rr.arrayBuffer());break;} console.log(' retry',rr.status); await sleep(8000*(k+1));}
  if(!buf){console.log(key,'download failed');continue;}
  const ext=url.split('?')[0].split('.').pop();
  fs.writeFileSync(`${out}/${key}.${ext}`,buf);
  const m=vi.extmetadata||{};
  fs.writeFileSync(`${out}/${key}.json`,JSON.stringify({file:`${key}.${ext}`,title,author:strip(m.Artist?.value).slice(0,140)||'Unknown',license:strip(m.LicenseShortName?.value),source:vi.descriptionurl},null,1));
  console.log(key,'ok',Math.round(buf.length/1024)+'KB',strip(m.LicenseShortName?.value));
  await sleep(2500);
}

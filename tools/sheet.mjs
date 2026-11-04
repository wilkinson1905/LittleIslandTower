// Contact sheet of whole frames: node tools/sheet.mjs out.png "t1,t2,..." [query] [cols]
// Each frame is captured at 640x360 through the page itself, so nothing is resampled.
import { open } from './drive.mjs';
import { writeFileSync } from 'node:fs';

const [out, times, query = '', cols = '3'] = process.argv.slice(2);
const page = await open(query);
const list = times.split(',').map(Number);
const url = await page.evaluate(`(()=>{
  const c=${+cols}, list=${JSON.stringify(list)}, rows=Math.ceil(list.length/c);
  const S=document.createElement('canvas'); S.width=c*640; S.height=rows*360;
  const x=S.getContext('2d'); x.imageSmoothingEnabled=false;
  const v=document.getElementById('view');
  list.forEach((t,i)=>{ dollhouse.CFG.zoom=[]; dollhouse.renderAt(t); x.drawImage(v,0,0,1920,1080,(i%c)*640,((i/c)|0)*360,640,360); });
  return S.toDataURL('image/png');
})()`);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
if (page.logs.length) console.log(page.logs.slice(0, 20).join('\n'));
page.close();
console.log('saved', out);

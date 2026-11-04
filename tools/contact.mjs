// A contact sheet of crops at many moments: node tools/contact.mjs out.png "query" x,y,w,h "t1,t2,t3,..." [columns] [scale] ["expression"]
import { open } from './drive.mjs';
import { writeFileSync } from 'node:fs';
const [out, q, rect, times, cols = '4', scale = '3', expr] = process.argv.slice(2);
const page = await open(q);
await new Promise(r => setTimeout(r, 300));
if (expr) await page.evaluate(expr);
const url = await page.evaluate(`(() => {
  const [x, y, w, h] = [${rect}], ts = [${times}], c = ${cols}, S = ${scale}, v = document.getElementById('view');
  const k = v.width / 360;
  const rows = Math.ceil(ts.length / c), o = document.createElement('canvas');
  o.width = c * (w * S + 6); o.height = rows * (h * S + 18);
  const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#222'; g.fillRect(0, 0, o.width, o.height);
  g.font = '12px sans-serif';
  ts.forEach((t, n) => {
    dollhouse.renderAt(t);
    const X = n % c * (w * S + 6), Y = (n / c | 0) * (h * S + 18);
    g.drawImage(v, x * k, y * k, w * k, h * k, X, Y + 14, w * S, h * S);
    g.fillStyle = '#fff'; g.fillText(t + 's', X + 2, Y + 11);
  });
  return o.toDataURL('image/png');
})()`);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
if (page.logs.length) console.log(page.logs.slice(0, 10).join('\n'));
page.close();
console.log('saved', out);

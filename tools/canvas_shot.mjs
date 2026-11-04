// Saves the canvas at full size, bypassing the window: node tools/canvas_shot.mjs out.png "query" ["expression to evaluate first"]
import { open } from './drive.mjs';
import { writeFileSync } from 'node:fs';
const [out, q = '', expr] = process.argv.slice(2);
const page = await open(q);
await new Promise(r => setTimeout(r, 300));
if (expr) await page.evaluate(expr);
const url = await page.evaluate(`document.getElementById('view').toDataURL('image/png')`);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
if (page.logs.length) console.log(page.logs.slice(0, 10).join('\n'));
page.close();
console.log('saved', out);

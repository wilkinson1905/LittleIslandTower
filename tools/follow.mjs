// Crops around a character at given times: node tools/follow.mjs outDir who "t1,t2,..." [query] [w]
// who = girl | dog | cat. Saves one screenshot per time, centred on that character.
import { open } from './drive.mjs';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const [dir, who, times, query = '', width = '110'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const page = await open(query);
const w = +width, h = Math.round(w * 9 / 16);
for (const t of times.split(',').map(Number)) {
  const p = await page.evaluate(`dollhouse.renderAt(${t}); dollhouse.pose().${who}`);
  const sx = 320 + p[0] - p[1], sy = 168 + ((p[0] + p[1]) >> 1) - p[2] - 10;
  const x = Math.round(sx - w / 2), y = Math.round(sy - h / 2);
  await page.evaluate(`dollhouse.CFG.zoom=[${x},${y},${w},${h}];dollhouse.renderAt(${t});dollhouse.CFG.zoom=[];1`);
  const name = `${who}_${String(t).replace('.', '_')}.png`;
  await page.shot(join(dir, name));
  console.log(name, JSON.stringify(p));
}
if (page.logs.length) console.log(page.logs.slice(0, 20).join('\n'));
page.close();

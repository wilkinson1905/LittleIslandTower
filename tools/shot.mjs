// Headless capture for review: node tools/shot.mjs out.png "t=30&zoom=0,0,320,180" [extra chrome wait ms]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [out, query = 't=0', budget = '4000'] = process.argv.slice(2);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'file:///' + resolve('dollhouse.html').replace(/\\/g, '/') + '?' + query;
const r = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1920,1080', `--virtual-time-budget=${budget}`, '--allow-file-access-from-files',
  '--enable-logging=stderr', '--v=0',
  `--screenshot=${resolve(out)}`, url,
], { encoding: 'utf8', timeout: 90000 });
const errs = (r.stderr || '').split('\n').filter(l => /CONSOLE|Uncaught|Error:/.test(l) && !/GPU|gcm|dbus|task_runner/i.test(l));
if (errs.length) console.log(errs.slice(0, 12).join('\n'));
console.log('saved', out, 'status', r.status);

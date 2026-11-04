// Renders scenes frame by frame and encodes a video, so the result never depends on machine speed.
//   node tools/record.mjs scenes.json out.mp4 [fps]
//   node tools/record.mjs scenes.json outDir --stills     (three stills per scene, for review)
// scenes.json: [{ "name", "seed", "block", "t", "dur", "zoom": [x, y, w, h] }]
// A whole-number scale keeps pixels crisp: zoom widths 640, 480, 320, 240, 192, 160 in landscape;
// 360, 270, 180, 135, 120, 90 in portrait.
import { open } from './drive.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [file, out, opt] = process.argv.slice(2);
const scenes = JSON.parse(readFileSync(file, 'utf8'));
const page = await open('loop=1');
const grab = async (s, t) => {
  const url = await page.evaluate(`(() => { const C = dollhouse.CFG; C.seed = ${s.seed}; C.block = ${s.block}; C.zoom = ${JSON.stringify(s.zoom || [])};
    dollhouse.renderAt(${t}); return document.getElementById('view').toDataURL('image/png'); })()`);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (opt === '--stills') {
  mkdirSync(out, { recursive: true });
  for (const s of scenes) for (const u of [.1, .5, .9]) writeFileSync(join(out, `${s.name}_${Math.round(u * 10)}.png`), await grab(s, s.t + s.dur * u));
} else {
  const fps = +(opt || 60);
  const enc = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-maxrate', '25M', '-bufsize', '50M', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=out_color_matrix=bt709:flags=neighbor', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(fps), '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((res, rej) => enc.on('close', c => c ? rej(new Error('ffmpeg exit ' + c)) : res()));
  let frames = 0;
  for (const s of scenes) {
    const n = Math.round(s.dur * fps);
    for (let i = 0; i < n; i++) {
      if (!enc.stdin.write(await grab(s, s.t + i / fps))) await new Promise(r => enc.stdin.once('drain', r));
      frames++;
    }
    console.log(s.name, 'done', frames);
  }
  enc.stdin.end();
  await done;
  console.log('saved', out, frames, 'frames');
}
if (page.logs.length) console.log(page.logs.slice(0, 10).join('\n'));
page.close();

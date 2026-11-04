// Inlines src/*.js into one self-contained HTML file: node build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const parts = readdirSync(src).filter(f => f.endsWith('.js')).sort();
const js = parts.map(f => readFileSync(join(src, f), 'utf8')).join('\n');
const html = readFileSync(join(src, 'index.template.html'), 'utf8').replace('/*__SOURCES__*/', () => js);
writeFileSync(join(root, 'dollhouse.html'), html);
console.log(`dollhouse.html: ${(html.length / 1024).toFixed(1)} KB from ${parts.length} parts`);

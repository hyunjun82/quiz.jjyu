/**
 * 앱 아이콘을 내려받아 AVIF(96px)로 변환해 public/icons/에 저장하고
 * quizzes.json의 iconUrl을 로컬 경로로 교체한다.
 * GitHub Actions에서 실행됨 (.github/workflows/icons.yml)
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', 'quizzes.json');
const OUT = path.join(ROOT, 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const d = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
let changed = 0;

for (const q of d.quizzes) {
  if (!q.iconUrl || !q.iconUrl.startsWith('http')) continue;
  try {
    const res = await fetch(q.iconUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(OUT, `${q.slug}.avif`);
    await sharp(buf).resize(96, 96).avif({ quality: 60 }).toFile(file);
    q.iconUrl = `/icons/${q.slug}.avif`;
    changed += 1;
    console.log(`✓ ${q.slug} → ${(fs.statSync(file).size / 1024).toFixed(1)}KB`);
  } catch (e) {
    console.warn(`✗ ${q.slug}: ${e.message} (외부 URL 유지)`);
  }
}

if (changed > 0) fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
console.log(`완료: ${changed}개 AVIF 변환`);

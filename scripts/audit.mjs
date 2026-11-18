#!/usr/bin/env node
/**
 * 정답 자동 감사 — 사람이 매일 하던 "놓친 것·오답·이월·중복 점검"을 그대로 자동으로 한다.
 *
 * 2026-11-18 추가. 운영자가 장기 부재해도 사이트에 틀린 정답이 남지 않게 한다.
 * 10/20~11/11 수동 점검에서 실제로 지운 유형만 규칙으로 옮겼다(추측 규칙 없음):
 *
 *   [이월]   어제 파일(또는 어제 삭제 기록)에 지문이 똑같은 항목이 있는데 오늘 또 올라옴
 *            — 게임톡 00:00 재게시, 다비야 늦은 등록, 퀴즈벨 껍데기 제목. (REPEAT_OK 퀴즈는 제외)
 *   [중복]   같은 퀴즈 안에서 정답이 같은 항목이 둘 — 지문이 껍데기(날짜·앱 이름뿐)인 쪽을 지운다.
 *   [오답]   지문이 같은데 정답이 다른 항목이 같은 퀴즈 안에 둘 — 앱테크 정답과 같은 쪽을 남긴다.
 *            앱테크에도 없으면 손대지 않고 보고만 한다(추측 금지).
 *   [누락]   앱테크 오늘 카드에 있는 (퀴즈, 지문)이 우리 파일에 없고, 어제 파일에도 없으면 추가한다.
 *            지문 없는 카드·'이월값'으로 보이는 카드는 추가하지 않는다.
 *
 * 변경이 있으면 커밋·푸시한다(배포는 push 로 자동). 실행: node scripts/audit.mjs [--dry]
 */
import fs from 'fs';
import { execSync } from 'child_process';
import {
  parseApptech,
  normalize,
  itemKey,
  loadExisting,
  fileFor,
  recordTombstone,
  loadYesterdayKeys,
  isGenericQuestion,
  kstToday,
  kstStamp,
} from './collect.mjs';

const DRY = process.argv.includes('--dry');
const today = kstToday();
const REPEAT_OK = new Set(['yes24', 'monimo', 'cashwalk', 'cashdoc']);
// 지문 비교: 앞의 "Q." 와 기호를 떼고 글자만 본다. 정답 비교: "2. 수원"·"② 수원"·"2번 수원"을 같은 것으로 본다.
const nq = (s) => String(s || '').replace(/^\s*Q\s*[.:]?\s*/i, '').replace(/[^가-힣0-9A-Za-z]/g, '').toLowerCase();
const na = (s) => normalize(String(s || '').replace(/^\s*(\d{1,2}\s*[.)]|[①②③④⑤⑥⑦⑧⑨⑩])\s*/, (m) => (/\d/.test(m) ? m.replace(/[.)]/, '번') : m)));
// 두 지문이 같은 문제인가: 하나가 다른 하나의 앞 20자를 품으면 같은 문제로 본다(출처마다 자르는 길이가 다르다)
const sameQ = (a, b) => a.length >= 12 && b.length >= 12 && (a === b || a.includes(b.slice(0, 20)) || b.includes(a.slice(0, 20)));
// 껍데기 지문: "11월4일 KB스타뱅킹 스타퀴즈 정답", "카카오뱅크 AI 이모지 퀴즈 (1회차)" 등
const isShell = (q, slug) => isGenericQuestion(q, slug) || /^\d{1,2}월\s*\d{1,2}일/.test(String(q || ''));

const ROUNDS = Object.fromEntries(JSON.parse(fs.readFileSync('data/quizzes.json', 'utf8')).quizzes.map((q) => [q.slug, (q.releaseTimes || []).length]));
const yd = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
const ydKo = [`${Number(yd.slice(5, 7))}월 ${Number(yd.slice(8, 10))}일`, `${Number(yd.slice(5, 7))}월${Number(yd.slice(8, 10))}일`];
const data = loadExisting(today);
const yest = loadYesterdayKeys(today);
const log = [];
const removed = [];
let changed = false;

function drop(slug, idx, reason) {
  const arr = data.answers[slug];
  const [it] = arr.splice(idx, 1);
  removed.push({ slug, it, reason });
  log.push(`[삭제] ${slug} "${String(it.question).slice(0, 40)}" => "${it.answer}" — ${reason}`);
  if (!DRY) recordTombstone(today, slug, it, `자동 감사: ${reason}`);
  changed = true;
}

// 1) 이월 · 2) 중복 · 3) 오답(같은 지문, 다른 정답)
let apptech = [];
try {
  const html = await (await fetch('https://apptech.spacexai.workers.dev/', { signal: AbortSignal.timeout(30000) })).text();
  apptech = parseApptech(html, today).filter((x) => x.question && !isGenericQuestion(x.question, x.slug));
} catch (e) {
  log.push(`[경고] 앱테크 페이지를 못 읽음: ${e.message} — 오답·누락 판정은 건너뜀`);
}
const apBy = new Map(); // slug -> [{q, a}]
for (const x of apptech) (apBy.get(x.slug) || apBy.set(x.slug, []).get(x.slug)).push({ q: nq(x.question), a: na(x.answer), raw: x });

for (const [slug, arr] of Object.entries(data.answers)) {
  if (!Array.isArray(arr) || arr.length === 0) continue;

  // [이월] 어제와 지문이 같은 항목 (껍데기 지문은 지문 비교가 무의미하므로 '지문+정답' 쌍으로 본다)
  if (!REPEAT_OK.has(slug) && yest[slug]) {
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      const it = arr[i];
      const q = nq(it.question);
      const shell = isShell(it.question, slug);
      const apHas = apBy.get(slug)?.some((p) => p.a === na(it.answer));
      const yAns = yest[slug].a.has(itemKey(it));
      let hit = false;
      if (!shell) {
        // 지문이 어제와 같음(앞 20자 포함 비교) — 게임톡 00:00 재게시, 다비야 늦은 등록
        hit = q.length >= 12 && [...yest[slug].q].some((yq) => sameQ(yq, q));
        // 지문에 어제 날짜가 박혀 있고("[출처] 11월 5일") 정답도 어제 것
        if (!hit && yAns && ydKo.some((k) => String(it.question).includes(k))) hit = true;
      } else {
        // 껍데기 지문: 정답이 어제 것과 같고 오늘 앱테크엔 없는 정답 — 하루 1회 출제 퀴즈에만 적용
        //   (하루 여러 회차인 OX 퀴즈는 어제와 같은 O/X가 정상이라 손대지 않는다)
        hit = yest[slug].qa.has(`${q}|${itemKey(it)}`) || (yAns && !apHas && (ROUNDS[slug] || 0) <= 1 && apBy.has(slug));
      }
      if (hit) drop(slug, i, '이월 — 어제 올라간 문제가 오늘 다시 수집됨');
    }
  }

  // [중복] 번호만 있는 정답("2번")이 껍데기 지문에 붙어 있고, 같은 번호로 시작하는 정답("② 멕시코")이 따로 있음
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const m = String(arr[i].answer || '').trim().match(/^(?:(\d{1,2})\s*번?|([①②③④⑤⑥⑦⑧⑨⑩]))$/);
    if (!m || !isShell(arr[i].question, slug)) continue;
    const n = m[1] ? Number(m[1]) : '①②③④⑤⑥⑦⑧⑨⑩'.indexOf(m[2]) + 1;
    const j = arr.findIndex((o, k) => k !== i && new RegExp(`^\\s*(${n}\\s*[.)번]|${'①②③④⑤⑥⑦⑧⑨⑩'[n - 1]})\\s*\\S`).test(String(o.answer || '')));
    if (j >= 0) drop(slug, i, `중복 — "${arr[j].answer}"와 같은 번호`);
  }

  // [중복] 정답이 같은 항목 둘 → 껍데기 지문 쪽 삭제
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const a = na(arr[i].answer);
    if (!a) continue;
    const j = arr.findIndex((o, k) => k !== i && na(o.answer) === a);
    if (j < 0) continue;
    const iShell = isShell(arr[i].question, slug), jShell = isShell(arr[j].question, slug);
    if (iShell && !jShell) drop(slug, i, `중복 — "${String(arr[j].question).slice(0, 30)}"와 같은 정답`);
    else if (iShell && jShell && nq(arr[i].question) === nq(arr[j].question)) drop(slug, i, '중복 — 지문·정답 모두 동일');
  }

  // [오답] 지문 같고 정답 다름 → 앱테크와 같은 쪽만 남김
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const q = nq(arr[i].question);
    if (q.length < 12) continue;
    const j = arr.findIndex((o, k) => k !== i && sameQ(nq(o.question), q) && na(o.answer) !== na(arr[i].answer));
    if (j < 0) continue;
    const ap = apBy.get(slug)?.find((p) => sameQ(p.q, q));
    if (!ap) { log.push(`[보고] ${slug} 같은 지문에 정답 둘 "${arr[i].answer}" / "${arr[j].answer}" — 앱테크에 없어 손대지 않음`); continue; }
    if (na(arr[i].answer) !== ap.a && na(arr[j].answer) === ap.a) drop(slug, i, `오답 — 앱테크 정답 "${ap.raw.answer}"과 다름`);
  }
}

// [누락] 앱테크 오늘 카드가 우리 파일에 없음 (어제 것도 아님)
for (const x of apptech) {
  const slug = x.slug;
  if (!Array.isArray(data.answers[slug])) continue;
  const q = nq(x.question);
  if (q.length < 12) continue;
  if (yest[slug]?.q.has(q)) continue; // 어제 문제가 아직 떠 있는 것
  const ours = data.answers[slug];
  const have = ours.some((o) => sameQ(nq(o.question), q) || na(o.answer) === na(x.answer));
  if (have) continue;
  ours.push({ question: x.question, answer: x.answer, note: '', source: 'apptech', publishedAt: kstStamp() });
  log.push(`[추가] ${slug} "${x.question.slice(0, 40)}" => "${x.answer}" — 앱테크에 있는데 우리에게 없음`);
  changed = true;
}

console.log(`[자동 감사] ${today} · 앱테크 카드 ${apptech.length}개 대조 · 변경 ${changed ? log.filter((l) => /^\[(삭제|추가)\]/.test(l)).length : 0}건`);
for (const l of log) console.log('  ' + l);

if (!changed || DRY) process.exit(0);

data.updatedAt = kstStamp();
fs.writeFileSync(fileFor(today), `${JSON.stringify(data, null, 2)}\n`);
try {
  execSync('git config user.name "quiz-audit" && git config user.email "audit@quiz.jjyu.co.kr"', { stdio: 'ignore' });
  execSync(`git add data/answers/${today}.json data/answers/${today}.deleted.json`, { stdio: 'inherit' });
  execSync(`git commit -q -m "audit: ${today} 자동 감사 — ${log.filter((l) => /^\[(삭제|추가)\]/.test(l)).length}건"`, { stdio: 'inherit' });
  execSync('git pull -q --rebase origin main && git push -q origin HEAD:main', { stdio: 'inherit' });
  console.log('푸시 완료');
} catch (e) {
  console.log('푸시 실패: ' + e.message);
  process.exit(1);
}

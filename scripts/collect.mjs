/**
 * 정답 실시간 수집 스크립트 — "공개되는 순간 잡아서 즉시 발행"이 목표다.
 *
 * ── 왜 이런 구조인가 ────────────────────────────────────────────────
 * 이 사이트의 수익은 "정답을 검색하는 사람이 뜨자마자 우리 사이트로 오는 것"에서
 * 나온다. 언론사가 올린 뒤에 따라 올리면 트래픽을 대부분 놓친다. 그래서 이 스크립트는
 * 단순 주기 폴링이 아니라 "발행 시각 조준(hot window) + 초 단위 감시" 방식으로 돈다.
 *
 *   1) quizzes.json의 releaseTimes로 지금이 어느 퀴즈의 공개 직후인지 계산한다.
 *   2) 공개 직후인데 아직 정답이 0건인 퀴즈가 하나라도 있으면 = HOT 상태.
 *      HOT일 때는 WATCH_SECONDS 동안 POLL_SECONDS(기본 30초) 간격으로 소스를 재확인하고,
 *      새 정답이 잡히는 즉시 커밋·푸시한다(다음 실행을 기다리지 않는다).
 *   3) HOT이 아니면 1회만 확인하고 몇 초 만에 끝낸다 — Actions 사용량 낭비 방지.
 *
 * GitHub Actions cron은 최소 간격이 5분이고 부하에 따라 몇 분 밀리기도 한다. 그래서
 * "5분마다 작업을 띄우되, 작업 하나가 그 5분 구간을 30초 간격으로 메우는" 방식으로
 * cron 해상도 한계를 우회한다.
 *
 * ── 소스 ────────────────────────────────────────────────────────────
 *   A. luckyquiz3.blogspot.com  — 8개 슬러그. 문제 지문이 길고 정확해 1순위.
 *   B. quizbells.com            — sourceSlug가 있는 21개 슬러그 전부. 갱신이 빠름.
 * 둘 다 AI 없이 순수 파싱이라 한 바퀴에 몇 초면 끝난다.
 *
 * ⚠️ 소스 HTML 구조가 바뀌면 parseEntry(A) / parseQuizbells(B)만 고치면 된다.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const ANSWERS_DIR = path.join(process.cwd(), 'data', 'answers');
const FEED_URL = 'https://luckyquiz3.blogspot.com/feeds/posts/default?alt=json&max-results=60';
const QUIZBELLS = (sourceSlug) => `https://quizbells.com/quiz/${sourceSlug}/today/answer`;

// 공개 시각 이후 이만큼(분) 동안은 "지금 막 뜰 때"로 보고 초 단위 감시에 들어간다.
const HOT_WINDOW_MINUTES = 25;
// HOT일 때 한 번 실행에서 감시할 총 시간과 폴링 간격.
const WATCH_SECONDS = Number(process.env.WATCH_SECONDS ?? 240);
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 30);
// 찾는 즉시 git commit/push 할지 여부 (로컬 테스트에서는 끈다).
const AUTO_PUSH = process.env.AUTO_PUSH === '1';

const kstNow = () => new Date(Date.now() + KST_OFFSET);
const kstToday = () => kstNow().toISOString().slice(0, 10);
const kstStamp = () => kstNow().toISOString().replace('Z', '+09:00');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUIZZES = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'quizzes.json'), 'utf-8'),
).quizzes;
const QUIZ_SLUGS = QUIZZES.map((q) => q.slug);
const BY_SLUG = Object.fromEntries(QUIZZES.map((q) => [q.slug, q]));

/* ────────────────────────── 공통 유틸 ────────────────────────── */

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .trim();
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const clean = (s) => decodeEntities(stripTags(s));

const PLACEHOLDER = new Set(['잠시 후 공개', '준비중', '준비 중', '미공개', 'ㅡ', '-', '?', '']);

/**
 * 소스에서 긁은 정답 문자열이 진짜 정답인지 검증한다.
 * quizbells는 일부 퀴즈(토스 등)에 커뮤니티가 남긴 잡담이 정답 칸에 그대로 들어오는
 * 경우가 있다 — 실측 확인됨. 길이·개행·URL로 걸러낸다.
 */
function isSaneAnswer(a) {
  if (!a || PLACEHOLDER.has(a)) return false;
  if (a.length > 40) return false; // 정답은 대부분 10자 이내. 40자 넘으면 잡담/지문 혼입.
  if (/https?:\/\//i.test(a)) return false;
  if (/\d{1,2}시 \d{1,2}분/.test(a)) return false; // "지금 0시 23분 ..." 류 커뮤니티 글
  return true;
}

function normalize(s) {
  return String(s || '').replace(/[\s,.·/]/g, '').toLowerCase();
}

function itemKey(x) {
  return x.answer ? normalize(x.answer) : normalize((x.choices || []).join(','));
}

/**
 * 이미 있는 정답인지 판단. 소스마다 표기가 미묘하게 달라서("100만" vs "100만P",
 * "O" vs "O (그렇다)") 완전일치만 보면 같은 정답이 중복 등록된다.
 * 짧은 정답은 한쪽이 다른 쪽의 앞부분이면 같은 것으로 본다.
 */
function isDuplicate(current, item) {
  const key = itemKey(item);
  if (!key) return true;
  return current.some((x) => {
    const k = itemKey(x);
    if (k === key) return true;
    if (k.length >= 1 && key.length >= 1 && (k.startsWith(key) || key.startsWith(k))) {
      return Math.abs(k.length - key.length) <= 6;
    }
    return false;
  });
}

/* ────────────────────── 소스 A: luckyquiz3 블로그 ────────────────────── */

const CATEGORY_SLUG = {
  '캐시워크 돈버는퀴즈': 'cashwalk',
  '캐시닥/타임스프레드 용돈퀴즈': 'cashdoc',
  'OK캐쉬백 오퀴즈': 'ok-cashbag',
  '토스 행운퀴즈': 'toss-lucky',
};

function headerToSlug(category, header, title) {
  if (category === 'KB Pay 오늘의 퀴즈') {
    if (header.includes('스타뱅킹') || header.includes('스타퀴즈')) return 'kb-star';
    return 'kbpay';
  }
  if (category === '신한 퀴즈') return 'shinhan-sol';
  // '버즈빌 초성퀴즈'는 버즈빌 광고 SDK가 여러 제휴사(SK스토아, 자코모 등)에 꽂혀서
  // 브랜드마다 따로 올라오는 카테고리 — SK스토아 것만 추적 중이라 'SK스토아'가 있을 때만 매칭.
  if (category === '버즈빌 초성퀴즈') {
    if (header.includes('SK스토아') || title.includes('SK스토아')) return 'skstoa';
    return null;
  }
  return CATEGORY_SLUG[category] || null;
}

function parseEntry(entry) {
  const cats = (entry.category || []).map((c) => c.term);
  const category = cats[0];
  const title = clean(entry.title?.['$t'] || '');
  const content = entry.content?.['$t'] || '';

  const blocks = content.split(/(?=<div class="quiz-card">)/);
  const results = [];

  for (const block of blocks) {
    const hMatch = block.match(/quiz-header">(.*?)<\/h2>/);
    if (!hMatch) continue;
    const header = clean(hMatch[1]).replace(/^Q\.\s*/, '');

    const qMatch = block.match(/quiz-question">([\s\S]*?)<\/p>/);
    const question = qMatch ? clean(qMatch[1]) : '';

    const answers = [...block.matchAll(/quiz-answer-highlight[^"]*">([\s\S]*?)<\/span>/g)]
      .map((m) => clean(m[1]))
      .filter(isSaneAnswer);
    if (answers.length === 0) continue; // 아직 정답 미공개

    const slug = headerToSlug(category, header, title);
    if (!slug || !QUIZ_SLUGS.includes(slug)) continue;

    results.push({ slug, ...buildItem(question || title, answers) });
  }
  return results;
}

async function collectFromBlog() {
  const res = await fetch(FEED_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
  });
  if (!res.ok) throw new Error(`blog feed HTTP ${res.status}`);
  const feed = await res.json();
  const today = kstToday();
  const out = [];
  for (const entry of feed.feed?.entry || []) {
    const pub = entry.published?.['$t'] || '';
    if (!pub) continue;
    const pubKST = new Date(new Date(pub).getTime() + KST_OFFSET).toISOString().slice(0, 10);
    if (pubKST !== today) continue; // 오늘 게시물만
    out.push(...parseEntry(entry).map((r) => ({ ...r, source: 'blog' })));
  }
  return out;
}

/* ────────────────────── 소스 B: quizbells.com ────────────────────── */

/**
 * quizbells의 "정답 전체보기" 페이지에는 문제/정답 2열짜리 요약 <table>이 딱 하나 있다.
 * 이 표만 파싱한다. 본문 다른 곳은 광고·추천글이 섞여 신뢰할 수 없다.
 * 날짜 검증: <title>에 박힌 날짜가 오늘이 아니면 통째로 버린다(퀴즈벨은 정답이 아직
 * 없어도 어제 페이지를 그대로 노출하는 경우가 있어 이 검증이 필수다 — 실측 확인됨).
 */
function parseQuizbells(html, slug, today) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const dm = title.match(/(\d{4})년 (\d{2})월 (\d{2})일/);
  if (!dm || `${dm[1]}-${dm[2]}-${dm[3]}` !== today) return [];

  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  if (!table) return [];

  const rows = [
    ...table.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g),
  ];

  const out = [];
  for (const [, qCell, aCell] of rows) {
    const divs = [...aCell.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)].map((m) => clean(m[1]));
    const answers = (divs.length ? divs : [clean(aCell)]).filter(isSaneAnswer);
    if (answers.length === 0) continue;

    let question = clean(qCell);
    // 퀴즈벨은 문제 제목이 "퀴즈", "출석 퀴즈"처럼 지나치게 짧을 때가 있다.
    // 그대로 쓰면 우리 페이지 제목이 무의미해지므로 앱 이름(shortName)을 붙여 보강한다.
    // name이 아니라 shortName을 쓰는 이유: name은 '신한 쏠퀴즈 · 퀴즈팡팡 · 출석퀴즈'처럼
    // 길어서 '... 출석 퀴즈'와 겹치면 제목이 지저분해진다.
    if (question.length < 8) {
      const label = BY_SLUG[slug]?.shortName || BY_SLUG[slug]?.name || slug;
      question = question && !question.includes('퀴즈')
        ? `${label} — ${question}`
        : `${label}${question ? ` (${question})` : ' 오늘의 퀴즈'}`;
    }
    out.push({ slug, ...buildItem(question, answers) });
  }
  return out;
}

async function collectFromQuizbells() {
  const today = kstToday();
  const targets = QUIZZES.filter((q) => q.sourceSlug);
  const results = await Promise.all(
    targets.map(async (q) => {
      try {
        const res = await fetch(QUIZBELLS(q.sourceSlug), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        return parseQuizbells(await res.text(), q.slug, today).map((r) => ({
          ...r,
          source: 'quizbells',
        }));
      } catch {
        return []; // 소스 하나가 죽어도 전체를 멈추지 않는다
      }
    }),
  );
  return results.flat();
}

/* ────────────────────────── 조립 ────────────────────────── */

function buildItem(question, answers) {
  const uniq = [...new Set(answers)];
  if (uniq.length > 1) {
    return {
      question,
      answer: null,
      choices: uniq,
      note: '문제가 랜덤으로 여러 번 바뀌는 이벤트 퀴즈 — 화면의 초성 힌트와 일치하는 정답을 후보 중에서 확인하세요.',
    };
  }
  return { question, answer: uniq[0], note: '' };
}

function fileFor(today) {
  return path.join(ANSWERS_DIR, `${today}.json`);
}

function loadExisting(today) {
  const file = fileFor(today);
  if (fs.existsSync(file)) {
    const d = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const slug of QUIZ_SLUGS) if (!d.answers[slug]) d.answers[slug] = [];
    return d;
  }
  const empty = { date: today, updatedAt: null, answers: {} };
  for (const slug of QUIZ_SLUGS) empty.answers[slug] = [];
  return empty;
}

/**
 * 지금 "공개 직후"라서 초 단위로 붙어 있어야 하는 퀴즈 목록.
 * releaseTimes 중 하나가 HOT_WINDOW_MINUTES 이내에 지났는데 아직 정답이 없으면 HOT.
 */
function hotSlugs(existing) {
  const now = kstNow();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dow = now.getUTCDay(); // 0=일
  const hot = [];

  for (const q of QUIZZES) {
    const cad = q.cadence;
    if (cad?.type === 'weekly') {
      const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      if (!(cad.days || []).some((d) => map[d] === dow)) continue;
    }
    if (cad?.type === 'weekdays' && (dow === 0 || dow === 6)) continue;

    for (const t of q.releaseTimes || []) {
      const [h, m] = t.split(':').map(Number);
      const rel = h * 60 + m;
      // 자정 발행은 전날 23:5x에 미리 붙는 것도 허용(경계에서 놓치지 않도록)
      const delta = mins - rel;
      const inWindow = delta >= -2 && delta <= HOT_WINDOW_MINUTES;
      if (!inWindow) continue;
      const got = (existing.answers[q.slug] || []).length;
      if (got === 0) hot.push(q.slug);
      break;
    }
  }
  return [...new Set(hot)];
}

function gitCommitPush(message) {
  const run = (args) => execFileSync('git', args, { stdio: 'pipe' }).toString().trim();
  try {
    run(['add', 'data/answers']);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only']).toString().trim();
    if (!staged) return false;
    run(['-c', 'user.name=quizday-bot', '-c', 'user.email=bot@quizday', 'commit', '-m', message]);
    try {
      run(['pull', '--rebase', 'origin', 'main']);
    } catch {
      /* 리베이스 실패해도 push는 시도 */
    }
    run(['push', 'origin', 'HEAD:main']);
    return true;
  } catch (e) {
    console.error('git 실패:', e.stderr?.toString() || e.message);
    return false;
  }
}

/** 한 바퀴 수집. 새로 추가된 건수를 반환한다. */
async function collectOnce() {
  const today = kstToday();
  const existing = loadExisting(today);

  const [a, b] = await Promise.all([
    collectFromBlog().catch((e) => {
      console.error('블로그 소스 실패:', e.message);
      return [];
    }),
    collectFromQuizbells(),
  ]);
  // 블로그 먼저 넣어야 문제 지문이 긴 쪽이 우선 채택된다.
  const found = [...a, ...b];

  let added = 0;
  const bySlug = {};
  for (const f of found) {
    const current = existing.answers[f.slug] || (existing.answers[f.slug] = []);
    const item = { question: f.question, answer: f.answer, ...(f.choices ? { choices: f.choices } : {}), note: f.note };
    if (isDuplicate(current, item)) continue;
    current.push({ ...item, publishedAt: kstStamp() });
    added += 1;
    bySlug[f.slug] = (bySlug[f.slug] || 0) + 1;
  }

  if (added > 0) {
    existing.updatedAt = kstStamp();
    fs.mkdirSync(ANSWERS_DIR, { recursive: true });
    fs.writeFileSync(fileFor(today), JSON.stringify(existing, null, 2));
  }
  return { added, bySlug, existing };
}

async function main() {
  const t0 = Date.now();
  let first = await collectOnce();
  let total = first.added;
  const allBySlug = { ...first.bySlug };

  const report = (n, bySlug) =>
    `${n}건 (${Object.entries(bySlug).map(([s, c]) => `${s} ${c}`).join(', ')})`;

  if (first.added > 0) {
    console.log(`[즉시] 새 정답 ${report(first.added, first.bySlug)}`);
    if (AUTO_PUSH) gitCommitPush(`data: ${kstStamp().slice(5, 16).replace('T', ' ')} 정답 ${first.added}건 (실시간)`);
  }

  // 공개 직후인데 아직 안 뜬 퀴즈가 있으면 초 단위로 붙어서 감시한다.
  let hot = hotSlugs(first.existing);
  if (hot.length === 0) {
    console.log(total > 0 ? `완료 — 총 ${total}건` : '새 정답 없음 (감시 대상 없음)');
    return;
  }

  console.log(`[감시] 공개 직후 미수집 ${hot.length}개: ${hot.join(', ')} — ${POLL_SECONDS}초 간격으로 ${WATCH_SECONDS}초간 대기`);

  while ((Date.now() - t0) / 1000 < WATCH_SECONDS && hot.length > 0) {
    await sleep(POLL_SECONDS * 1000);
    const r = await collectOnce();
    if (r.added > 0) {
      total += r.added;
      for (const [s, c] of Object.entries(r.bySlug)) allBySlug[s] = (allBySlug[s] || 0) + c;
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(`[감시 ${elapsed}초] 새 정답 ${report(r.added, r.bySlug)} — 즉시 발행`);
      if (AUTO_PUSH) gitCommitPush(`data: ${kstStamp().slice(5, 16).replace('T', ' ')} 정답 ${r.added}건 (공개 직후 포착)`);
    }
    hot = hotSlugs(r.existing);
  }

  if (hot.length > 0) {
    console.log(`[감시 종료] 아직 미공개: ${hot.join(', ')} — 다음 실행에서 계속 감시`);
  }
  console.log(total > 0 ? `완료 — 총 ${report(total, allBySlug)}` : '완료 — 새 정답 없음');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

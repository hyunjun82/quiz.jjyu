/**
 * 빠른 정답 수집 스크립트 — luckyquiz3.blogspot.com을 몇 분 간격으로 확인해
 * 새로 채워진 정답을 즉시 반영한다. AI 검색 없이 순수 파싱이라 몇 초 안에 끝나고,
 * 그만큼 GitHub Actions에서 촘촘하게(5~10분) 돌릴 수 있다.
 *
 * 이 스크립트가 커버하는 건 luckyquiz3가 다루는 6개뿐이다:
 *   캐시워크, 캐시닥, OK캐쉬백 오퀴즈, KB Pay/KB스타뱅킹, 신한 쏠퀴즈/퀴즈팡팡, 토스 행운퀴즈
 * 나머지 24개는 Claude Code Remote의 시간당 AI 수집 트리거가 담당한다 — 이 스크립트는
 * "가장 자주 바뀌고 트래픽이 큰 소수를 최대한 빨리" 잡는 역할이고, 전체 커버리지 담당이 아니다.
 *
 * ⚠️ luckyquiz3의 HTML 구조가 바뀌면 이 파일의 파싱 로직만 고치면 된다.
 */

import fs from 'fs';
import path from 'path';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const now = new Date(Date.now() + KST_OFFSET);
const today = now.toISOString().slice(0, 10); // YYYY-MM-DD (KST)

const ANSWERS_DIR = path.join(process.cwd(), 'data', 'answers');
const FILE = path.join(ANSWERS_DIR, `${today}.json`);
const FEED_URL = 'https://luckyquiz3.blogspot.com/feeds/posts/default?alt=json&max-results=60';

const QUIZ_SLUGS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'quizzes.json'), 'utf-8'),
).quizzes.map((q) => q.slug);

// 피드 category → 사이트 slug. 'KB Pay 오늘의 퀴즈'/'신한 퀴즈'는 한 글에 두 퀴즈가
// 섞여 나와서 quiz-card 헤더 텍스트로 다시 나눈다 (headerToSlug).
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
  // 브랜드마다 따로 올라오는 카테고리 — SK스토아 것만 우리가 추적 중이라 헤더/제목에
  // 'SK스토아'가 있을 때만 매칭하고, 나머지 브랜드는 스킵한다.
  if (category === '버즈빌 초성퀴즈') {
    if (header.includes('SK스토아') || title.includes('SK스토아')) return 'skstoa';
    return null;
  }
  return CATEGORY_SLUG[category] || null;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const PLACEHOLDER = new Set(['잠시 후 공개', 'ㅡ', '-', '']);

async function fetchFeed() {
  const res = await fetch(FEED_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
  });
  if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
  return res.json();
}

/** 한 포스트(entry) 안에 있는 quiz-card 블록들을 각각 파싱한다 */
function parseEntry(entry) {
  const cats = (entry.category || []).map((c) => c.term);
  const category = cats[0];
  const title = stripTags(decodeEntities(entry.title?.['$t'] || ''));
  const content = entry.content?.['$t'] || '';

  const blocks = content.split(/(?=<div class="quiz-card">)/);
  const results = [];

  for (const block of blocks) {
    const hMatch = block.match(/quiz-header">(.*?)<\/h2>/);
    if (!hMatch) continue;
    const header = stripTags(decodeEntities(hMatch[1])).replace(/^Q\.\s*/, '');

    const qMatch = block.match(/quiz-question">([\s\S]*?)<\/p>/);
    const question = qMatch ? stripTags(decodeEntities(qMatch[1])) : '';

    const answerMatches = [...block.matchAll(/quiz-answer-highlight[^"]*">([\s\S]*?)<\/span>/g)]
      .map((m) => decodeEntities(stripTags(m[1])))
      .filter((a) => !PLACEHOLDER.has(a));
    if (answerMatches.length === 0) continue; // 아직 정답 미공개

    const slug = headerToSlug(category, header, title);
    if (!slug || !QUIZ_SLUGS.includes(slug)) continue;

    const uniqAnswers = [...new Set(answerMatches)];
    const item = { question: question || title };
    if (uniqAnswers.length > 1) {
      item.answer = null;
      item.choices = uniqAnswers;
      item.note =
        '문제가 랜덤으로 여러 번 바뀌는 이벤트 퀴즈 — 화면의 초성 힌트와 일치하는 정답을 후보 중에서 확인하세요.';
    } else {
      item.answer = uniqAnswers[0];
      item.note = '';
    }
    results.push({ slug, item });
  }
  return results;
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function itemKey(x) {
  return x.answer ? normalize(x.answer) : normalize((x.choices || []).join(','));
}

function loadExisting() {
  if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const empty = { date: today, updatedAt: null, answers: {} };
  for (const slug of QUIZ_SLUGS) empty.answers[slug] = [];
  return empty;
}

async function main() {
  const feed = await fetchFeed();
  const entries = feed.feed?.entry || [];
  const existing = loadExisting();
  let added = 0;
  const addedBySlug = {};

  for (const entry of entries) {
    const pub = entry.published?.['$t'] || '';
    if (!pub) continue;
    const pubDateKST = new Date(new Date(pub).getTime() + KST_OFFSET).toISOString().slice(0, 10);
    if (pubDateKST !== today) continue; // 오늘 게시물만

    for (const { slug, item } of parseEntry(entry)) {
      if (!existing.answers[slug]) existing.answers[slug] = [];
      const current = existing.answers[slug];
      const key = itemKey(item);
      const dup = current.some((x) => itemKey(x) === key);
      if (!dup) {
        current.push({
          question: item.question,
          answer: item.answer,
          ...(item.choices ? { choices: item.choices } : {}),
          note: item.note,
          publishedAt: new Date(Date.now() + KST_OFFSET).toISOString().replace('Z', '+09:00'),
        });
        added += 1;
        addedBySlug[slug] = (addedBySlug[slug] || 0) + 1;
      }
    }
  }

  if (added > 0) {
    existing.updatedAt = new Date(Date.now() + KST_OFFSET).toISOString().replace('Z', '+09:00');
    fs.mkdirSync(ANSWERS_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(existing, null, 2));
    const summary = Object.entries(addedBySlug).map(([s, n]) => `${s} ${n}건`).join(', ');
    console.log(`새 정답 ${added}건 추가 (${summary}) → ${FILE}`);
  } else {
    console.log('새 정답 없음 — 변경 없음');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

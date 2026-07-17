/**
 * 정답 자동 수집 스크립트 (10분 주기로 GitHub Actions에서 실행)
 *
 * 동작 원리:
 *  1. 소스 사이트들에서 오늘자 정답을 수집
 *  2. 2개 이상 소스에서 일치하는 정답만 채택 (교차 검증)
 *  3. data/answers/YYYY-MM-DD.json 갱신 — 새 정답이 있을 때만 파일 변경
 *  4. 워크플로우가 변경을 감지하면 커밋 → Cloudflare Pages 자동 재배포 (1~2분)
 *
 * ⚠️ 소스 사이트의 HTML 구조는 수시로 바뀝니다. 파서가 깨지면
 *    이 파일의 파싱 로직만 수정하면 됩니다. (Claude에게 "수집 스크립트
 *    고쳐줘"라고 하면 됩니다)
 */

import fs from 'fs';
import path from 'path';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const now = new Date(Date.now() + KST_OFFSET);
const today = now.toISOString().slice(0, 10); // YYYY-MM-DD (KST)

const ANSWERS_DIR = path.join(process.cwd(), 'data', 'answers');
const FILE = path.join(ANSWERS_DIR, `${today}.json`);

const QUIZ_SLUGS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'quizzes.json'), 'utf-8'),
).quizzes.map((q) => q.slug);

/* ── 소스별 수집기 ──────────────────────────────
 * 각 수집기는 { [slug]: [{question, answer}] } 형태를 반환.
 * 사이트 구조가 확정되면 파싱 로직을 채워 넣는다.
 * (초기 운영은 Cowork 예약 작업으로 수집하고, 구조 파악 후
 *  이 스크립트로 이전하면 완전 무인 운영이 된다)
 */

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function sourceA() {
  // TODO: 소스 1 파싱 (예: 정답 모음 사이트의 오늘자 페이지)
  return {};
}

async function sourceB() {
  // TODO: 소스 2 파싱
  return {};
}

/* ── 교차 검증 & 병합 ─────────────────────────── */

function normalize(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function crossValidate(sources) {
  const merged = {};
  for (const slug of QUIZ_SLUGS) {
    const candidates = sources.flatMap((src) => src[slug] || []);
    const confirmed = [];
    for (const c of candidates) {
      const dup = candidates.filter(
        (x) => normalize(x.answer) === normalize(c.answer),
      );
      const already = confirmed.some(
        (x) => normalize(x.answer) === normalize(c.answer),
      );
      if (dup.length >= 2 && !already) confirmed.push(c);
    }
    merged[slug] = confirmed;
  }
  return merged;
}

/* ── 파일 갱신 (새 정답만 추가, 기존 정답 유지) ── */

function loadExisting() {
  if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const empty = { date: today, updatedAt: null, answers: {} };
  for (const slug of QUIZ_SLUGS) empty.answers[slug] = [];
  return empty;
}

async function main() {
  const results = await Promise.allSettled([sourceA(), sourceB()]);
  const sources = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  if (sources.length === 0) {
    console.log('모든 소스 수집 실패 — 변경 없음');
    return;
  }

  const collected = crossValidate(sources);
  const existing = loadExisting();
  let added = 0;

  for (const slug of QUIZ_SLUGS) {
    const current = existing.answers[slug] || [];
    for (const item of collected[slug] || []) {
      const dup = current.some(
        (x) => normalize(x.answer) === normalize(item.answer),
      );
      if (!dup) {
        current.push({
          question: item.question,
          answer: item.answer,
          note: '',
          publishedAt: new Date(Date.now() + KST_OFFSET)
            .toISOString()
            .replace('Z', '+09:00'),
        });
        added += 1;
      }
    }
    existing.answers[slug] = current;
  }

  if (added > 0) {
    existing.updatedAt = new Date(Date.now() + KST_OFFSET)
      .toISOString()
      .replace('Z', '+09:00');
    fs.mkdirSync(ANSWERS_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(existing, null, 2));
    console.log(`새 정답 ${added}건 추가 → ${FILE}`);
  } else {
    console.log('새 정답 없음 — 변경 없음');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

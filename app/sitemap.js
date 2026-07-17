import { getQuizzes, getAnswerDates } from '../lib/data';

export const dynamic = 'force-static';

export default function sitemap() {
  const base = 'https://quiz.jjyu.co.kr';
  const now = new Date();
  const quizzes = getQuizzes();
  const dates = getAnswerDates();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...quizzes.map((q) => ({
      url: `${base}/quiz/${q.slug}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    })),
    ...quizzes.flatMap((q) =>
      dates.map((d) => ({
        url: `${base}/quiz/${q.slug}/${d}/`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.6,
      })),
    ),
  ];
}

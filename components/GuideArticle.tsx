import { Link } from '@/i18n/navigation';

export interface GuideSection {
  heading: string;
  body: string;
}

interface GuideArticleProps {
  backLabel: string;
  backHref: string;
  title: string;
  intro: string;
  sections: GuideSection[];
  sourceLabel: string;
  source: string;
}

/**
 * 모든 가이드 글(리밸런싱/그레이엄 체크리스트/세제혜택 등)이 공유하는
 * 레이아웃. 제목 + 도입부 + 섹션(소제목+본문) 반복 + 출처 표기로 구성된다.
 */
export default function GuideArticle({
  backLabel,
  backHref,
  title,
  intro,
  sections,
  sourceLabel,
  source,
}: GuideArticleProps) {
  return (
    <article className="card mx-auto max-w-2xl">
      <Link href={backHref} className="mb-4 inline-block text-sm text-brand-700 hover:underline">
        {backLabel}
      </Link>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mb-6 text-sm leading-relaxed text-gray-700">{intro}</p>
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-1.5 text-base font-medium text-gray-900">{section.heading}</h2>
            <p className="text-sm leading-relaxed text-gray-700">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-400">
        {sourceLabel}: {source}
      </p>
    </article>
  );
}

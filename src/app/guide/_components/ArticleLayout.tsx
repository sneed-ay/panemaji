import React from "react";

type RelatedLink = {
  href: string;
  label: string;
};

type Props = {
  title: string;
  subtitle: string;
  breadcrumb: string;
  children: React.ReactNode;
  relatedLinks: RelatedLink[];
  ctaHref?: string;
  ctaLabel?: string;
};

export default function ArticleLayout({
  title,
  subtitle,
  breadcrumb,
  children,
  relatedLinks,
  ctaHref = "/",
  ctaLabel = "パネマジ掲示板で口コミをチェック →",
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <a href="/guide" className="hover:text-pink-600">ガイド</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{breadcrumb}</span>
      </nav>

      <article className="bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          {title}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{subtitle}</p>

        <div className="space-y-10 text-gray-700 text-sm sm:text-base leading-relaxed">
          {children}

          {/* CTA */}
          <section className="text-center">
            <a
              href={ctaHref}
              className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
            >
              {ctaLabel}
            </a>
          </section>

          {/* 関連記事 */}
          <section className="bg-gray-50 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">関連記事</h2>
            <ul className="space-y-2">
              {relatedLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-pink-600 hover:text-pink-800 hover:underline"
                  >
                    → {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
}

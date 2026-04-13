import React from "react";
import AdBanner from "@/components/AdBanner";

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
  slug?: string;
  datePublished?: string;
  dateModified?: string;
  description?: string;
};

export default function ArticleLayout({
  title,
  subtitle,
  breadcrumb,
  children,
  relatedLinks,
  ctaHref = "/",
  ctaLabel = "パネマジ掲示板で口コミをチェック →",
  slug,
  datePublished = "2025-01-01",
  dateModified = "2026-04-12",
  description,
}: Props) {
  const canonicalUrl = slug ? `https://panemaji.com/guide/${slug}` : "https://panemaji.com/guide";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "トップ", item: "https://panemaji.com" },
      { "@type": "ListItem", position: 2, name: "ガイド", item: "https://panemaji.com/guide" },
      { "@type": "ListItem", position: 3, name: breadcrumb, item: canonicalUrl },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description || subtitle,
    author: { "@type": "Organization", name: "パネマジ掲示板" },
    publisher: { "@type": "Organization", name: "パネマジ掲示板", url: "https://panemaji.com" },
    datePublished,
    dateModified,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  return (
    <div className="max-w-3xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
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

          {/* Ad Banner */}
          <AdBanner placement="inline" />

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

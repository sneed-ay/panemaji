import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "パネマジ掲示板へのお問い合わせはこちらからお願いいたします。",
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* パンくずリスト */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">お問い合わせ</span>
      </nav>

      <div className="bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">お問い合わせ</h1>
        <p className="text-sm text-gray-500 mb-6">
          ご質問・ご要望・掲載情報の削除依頼等は、下記フォームよりお問い合わせください。
        </p>
        <ContactForm />
      </div>
    </div>
  );
}

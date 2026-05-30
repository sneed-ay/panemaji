import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'ログイン',
  description: 'パネマジ掲示板の会員ログイン',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-6">
      <AuthForm mode="login" />
    </main>
  );
}

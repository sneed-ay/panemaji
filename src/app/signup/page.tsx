import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = {
  title: '新規会員登録',
  description: 'メアドとパスワードで30秒登録。広告スキップ・「気になる」・マイページ機能が解放されます。',
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-6">
      <AuthForm mode="signup" />
    </main>
  );
}

import type { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: '管理画面 | パネマジ',
  robots: { index: false, follow: false },
};

// 個人情報を扱うため静的化しない
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <AdminDashboard />;
}

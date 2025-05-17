// app/rp/admin/page.tsx
import { Metadata } from 'next';
import AdminPanel from './AdminPanel';

export const metadata: Metadata = {
  title: 'Admin - Random Payables',
  description: 'Admin panel for managing the Random Payables system',
};

export default function AdminPage() {
  return <AdminPanel />;
}
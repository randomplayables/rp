
// app/rp/page.tsx
import { Metadata } from 'next';
import RandomPayablesPage from './RandomPayablesPage';

export const metadata: Metadata = {
  title: 'Random Payables - RandomPlayables',
  description: 'Contribute to RandomPlayables and earn rewards through our probabilistic payout system',
};

export default function Page() {
  return <RandomPayablesPage />;
}
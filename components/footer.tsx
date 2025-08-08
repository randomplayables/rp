import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} mightymetrika. All rights reserved.</p>
        <div className="mt-2">
          <Link href="/terms-of-service" className="hover:text-emerald-600 transition-colors">
            Terms of Service
          </Link>
          <span className="mx-2">|</span>
          <Link href="/privacy-policy" className="hover:text-emerald-600 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
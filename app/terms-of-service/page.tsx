import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - randomplayables',
  description: 'Terms of Service for the randomplayables platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-white p-6 md:p-10 rounded-lg shadow-md max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Terms of Service</h1>
      <p className="mb-4 text-gray-600">Last updated: August 07, 2025</p>

      <div className="prose prose-lg max-w-none">
        <p>
          Please read these Terms of Service (&quot;Terms&quot;) carefully before using the <Link href="/">randomplayables.com</Link> website and its subdomains (the &quot;Service&quot;) operated by randomplayables (&quot;us&quot;, &quot;we&quot;, or &quot;our&quot;). This privacy policy was written by Gemini 2.5 Pro.
        </p>
        <p>
          Your access to and use of the Service is conditioned upon your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who wish to access or use the Service.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Accounts</h2>
        <p>
          When you create an account with us, you guarantee that you are above the age of 13, and that the information you provide us is accurate, complete, and current at all times. You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">2. User-Generated Content</h2>
        <p>
          Our Service allows you to create, post, link, store, share and otherwise make available certain information, text, graphics, games, or other material (&quot;Content&quot;). You are responsible for the Content that you post on or through the Service, including its legality, reliability, and appropriateness.
        </p>
        <p>
          By posting Content on or through the Service, you represent and warrant that: (i) the Content is yours (you own it) and/or you have the right to use it and the right to grant us the rights and license as provided in these Terms, and (ii) the posting of your Content on or through the Service does not violate the privacy rights, publicity rights, copyrights, contract rights or any other rights of any person or entity.
        </p>
        <p>
          You retain any and all of your rights to any Content you submit. However, by submitting Content, you grant us a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the Content in connection with the Service and our business, including for promoting the Service.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">3. Subscriptions and Payments</h2>
        <p>
          Some parts of the Service are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis (&quot;Billing Cycle&quot;). We use Stripe for payment processing. By submitting your payment information, you grant us the right to provide the information to Stripe to facilitate the completion of your purchase.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">4. Random Payables System</h2>
        <p>
          Our platform includes a system called &quot;Random Payables&quot; to reward user contributions. By participating and contributing to the platform, you earn points that translate into a probability of receiving a monetary payout. Payouts are not guaranteed and are subject to the terms and conditions of the Random Payables system, which may change over time. To receive payouts, you must connect a valid Stripe Connect account. We are not responsible for any taxes or fees associated with payouts.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Intellectual Property</h2>
        <p>
          The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of randomplayables. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">6. Termination</h2>
        <p>
          We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">7. Limitation Of Liability</h2>
        <p>
          In no event shall randomplayables, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">8. Changes</h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice prior to any new terms taking effect.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at: <a href="mailto:contact@mightymetrika.com">contact@mightymetrika.com</a>.
        </p>
      </div>
    </div>
  );
}
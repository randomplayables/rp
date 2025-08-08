import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - randomplayables',
  description: 'Privacy Policy for the randomplayables platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white p-6 md:p-10 rounded-lg shadow-md max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Privacy Policy</h1>
      <p className="mb-4 text-gray-600">Last updated: August 07, 2025</p>

      <div className="prose prose-lg max-w-none">
        <p>
          Welcome to randomplayables (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <Link href="/">randomplayables.com</Link> and our related subdomains (the &quot;Site&quot;). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site. This privacy policy was written by Gemini 2.5 Pro.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Collection of Your Information</h2>
        <p>We may collect information about you in a variety of ways. The information we may collect on the Site includes:</p>
        
        <h3 className="text-xl font-medium mt-6 mb-2">Personal Data</h3>
        <p>
          Personally identifiable information, such as your name, username, and email address, that you voluntarily give to us when you register with the Site. We use Clerk for authentication, which provides us with this information upon your sign-up.
        </p>

        <h3 className="text-xl font-medium mt-6 mb-2">Financial Data</h3>
        <p>
          For users who subscribe to a plan or set up payouts, we use Stripe as our payment processor. We do not directly store your credit card information. For payouts, we store your Stripe Connect Account ID to facilitate transfers. All financial transactions are handled by Stripe, and you should review their privacy policy.
        </p>

        <h3 className="text-xl font-medium mt-6 mb-2">User-Generated Content</h3>
        <p>
          We collect all content you create and upload to the platform, including but not limited to:
        </p>
        <ul>
            <li>Games and game sketches created in the GameLab.</li>
            <li>Data visualizations created in the DataLab.</li>
            <li>Surveys and instruments created using the Collect tool.</li>
            <li>Questions and answers posted on the Stack.</li>
            <li>Game submissions and related metadata.</li>
        </ul>

        <h3 className="text-xl font-medium mt-6 mb-2">Gameplay and Survey Data</h3>
        <p>
          We collect data generated from your interaction with games and surveys on the platform. This includes game session information, round data, scores, and your responses to surveys. This is essential for the citizen science mission of the platform.
        </p>
        
        <h3 className="text-xl font-medium mt-6 mb-2">Third-Party Integration Data</h3>
        <p>
          If you choose to connect your GitHub account, we will collect your GitHub username and an access token to facilitate features like repository uploads and peer review tracking.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Use of Your Information</h2>
        <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:</p>
        <ul>
            <li>Create and manage your account.</li>
            <li>Process your subscriptions and financial transactions.</li>
            <li>Facilitate payouts through the Random Payables system.</li>
            <li>Display your user-generated content and profile.</li>
            <li>Enable user-to-user communications and interactions.</li>
            <li>Aggregate anonymized data for research and analysis to support our citizen science mission.</li>
            <li>Monitor and analyze usage and trends to improve your experience with the Site.</li>
            <li>Notify you of updates to the Site.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Disclosure of Your Information</h2>
        <p>We do not sell your personal information. We may share information we have collected about you in certain situations:</p>
        <ul>
            <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others.</li>
            <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing (Stripe), user authentication (Clerk), and hosting (Vercel).</li>
            <li><strong>Publicly Visible Information:</strong> Your username, profile information, and any content you create (games, visualizations, questions, etc.) may be publicly visible to other users of the Site.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Security of Your Information</h2>
        <p>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
            <li>Review and update your account information at any time by logging into your profile.</li>
            <li>Delete your account. Please note that while your personal information will be deleted, some anonymized gameplay and user-generated content may be retained for research purposes.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
        <p>
          If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:contact@mightymetrika.com">contact@mightymetrika.com</a>.
        </p>
      </div>
    </div>
  );
}
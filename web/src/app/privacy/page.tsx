import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "How KKR Groceries collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-700">
      <Link href="/" className="text-sm text-emerald-700 font-semibold hover:underline">&larr; Back to store</Link>
      <h1 className="text-3xl font-extrabold text-slate-900 mt-4 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: 29 June 2026</p>

      <div className="space-y-6 leading-relaxed text-[15px]">
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">1. Who we are</h2>
          <p>KKR Groceries (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates this website to sell vegetables and groceries to businesses and consumers in Hyderabad. This policy explains what information we collect and how we use it.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">2. Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account details</strong> — your name, phone number, and/or email used to sign in.</li>
            <li><strong>Order details</strong> — items ordered, delivery address, shop name, and order history.</li>
            <li><strong>Location</strong> — delivery location (with your consent) to enable delivery and tracking.</li>
            <li><strong>Payment references</strong> — UPI transaction reference (UTR) you submit; we do not store card or bank credentials.</li>
            <li><strong>Usage data</strong> — basic technical and analytics data to operate and improve the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">3. How we use it</h2>
          <p>To process and deliver your orders, verify deliveries (OTP), provide support, send order and delivery notifications, reconcile payments, and improve our service. We do not sell your personal information.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">4. Sharing</h2>
          <p>We share information only as needed to run the service — for example, with our delivery agents (to deliver your order), and with service providers such as Google Firebase (hosting, database, authentication) and payment/SMS providers. These providers process data on our behalf.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">5. Data retention &amp; security</h2>
          <p>We retain order and account data for as long as your account is active or as required for legal/accounting purposes. We use industry-standard security (encrypted connections, access controls). No method is 100% secure, but we take reasonable measures to protect your data.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">6. Your choices</h2>
          <p>You may request access to or deletion of your account data, and you can opt out of non-essential notifications. Contact us using the details below.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">7. Contact</h2>
          <p>For any privacy questions or requests, contact us via the details on our <Link href="/" className="text-emerald-700 font-semibold hover:underline">homepage</Link> or the in-app Message Center.</p>
        </section>
      </div>
    </div>
  );
}

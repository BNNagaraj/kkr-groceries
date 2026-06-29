import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of KKR Groceries.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-700">
      <Link href="/" className="text-sm text-emerald-700 font-semibold hover:underline">&larr; Back to store</Link>
      <h1 className="text-3xl font-extrabold text-slate-900 mt-4 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: 29 June 2026</p>

      <div className="space-y-6 leading-relaxed text-[15px]">
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">1. Orders</h2>
          <p>By placing an order you agree to purchase the listed items at the displayed price. Orders are subject to acceptance and stock availability; we may revise or reject an order (e.g., if items are out of stock) and will notify you.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">2. Pricing &amp; minimums</h2>
          <p>Prices are shown per unit and may follow slab/wholesale tiers. Minimum order quantities (MOQ) may apply. Restaurant/Hotel (HORECA) pricing is available only to approved business accounts.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">3. Payment</h2>
          <p>You may pay online via UPI or by Cash on Delivery (where available). For UPI, submit your transaction reference (UTR) for confirmation. For Cash on Delivery, pay the delivery agent the order amount at the time of delivery.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">4. Delivery</h2>
          <p>We deliver within our serviceable area. Delivery timing is an estimate. A delivery OTP may be required to confirm receipt of your order.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">5. Cancellations &amp; refunds</h2>
          <p>Orders may be cancelled before dispatch. As we deal in perishable goods, returns are limited to quality issues reported at the time of delivery. Approved refunds for prepaid orders are processed to the original payment method.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">6. Accounts</h2>
          <p>You are responsible for the activity on your account and for keeping your sign-in details secure. We may suspend accounts involved in fraud or misuse.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">7. Liability</h2>
          <p>The service is provided on an &ldquo;as is&rdquo; basis. To the extent permitted by law, our liability for any claim is limited to the value of the order in question.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-1">8. Contact</h2>
          <p>Questions about these terms? Reach us via our <Link href="/" className="text-emerald-700 font-semibold hover:underline">homepage</Link> or the in-app Message Center. See also our <Link href="/privacy" className="text-emerald-700 font-semibold hover:underline">Privacy Policy</Link>.</p>
        </section>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useSelector } from "react-redux";

const TIER_CONFIG = {
  silver: {
    label: "Silver",
    emoji: "🥈",
    gradient: "from-slate-400 to-slate-500",
    accentColor: "slate-400",
    benefits: [
      { text: "100 connection requests per day", icon: "🤝" },
      { text: "1,000 messages per day", icon: "💬" },
      { text: "Blue verified tick for 1 year", icon: "✓" },
      { text: "Priority in feed", icon: "⚡" },
    ],
    limits: {
      requests: { total: 100, label: "100 / day" },
      messages: { total: 1000, label: "1,000 / day" },
    },
  },
  gold: {
    label: "Gold",
    emoji: "🥇",
    gradient: "from-amber-400 to-amber-600",
    accentColor: "amber-400",
    benefits: [
      { text: "Unlimited connection requests", icon: "🤝" },
      { text: "10,000 messages per day", icon: "💬" },
      { text: "Blue verified tick for 2 years", icon: "✓" },
      { text: "Priority in feed", icon: "⚡" },
      { text: "See who liked you", icon: "👀" },
      { text: "Advanced filters", icon: "🎯" },
    ],
    limits: {
      requests: { total: null, label: "Unlimited" },
      messages: { total: 10000, label: "10,000 / day" },
    },
  },
};

const VerifiedBadge = ({ className = "w-6 h-6" }) => (
  <svg className={`${className} text-blue-400`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" />
  </svg>
);

const Premium = () => {
  const [isPremium, setIsPremium] = useState(false);
  const [membershipType, setMembershipType] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const user = useSelector((store) => store.user);

  const verifyPremiumStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/verify/isPremium");
      if (res.data.isPremium) {
        setIsPremium(true);
        setMembershipType(res.data.membershipType || "");
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyPremiumStatus();
  }, [verifyPremiumStatus]);

  const buyMembership = async (type) => {
    try {
      setPaymentLoading(true);
      const res = await api.post("/payment/create", { membershipType: type });
      const order = res.data;
      const { amount, notes, currency, order_id } = order.data;

      if (!window.Razorpay) {
        alert("Payment service is loading. Please try again in a moment.");
        setPaymentLoading(false);
        return;
      }

      const options = {
        key: order.keyId,
        amount,
        currency,
        name: "DevTinder",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} Membership`,
        order_id: order_id,
        prefill: {
          name: notes.firstName + " " + notes.lastName,
          email: notes.email,
        },
        theme: { color: "#7c3aed" },
        handler: async function (response) {
          try {
            await api.post("/payment/verify", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            await verifyPremiumStatus();
          } catch (err) {
            console.error("Payment verification failed:", err);
            alert("Payment verification failed. If amount was deducted, it will be refunded within 5-7 days. Please contact support.");
          }
        },
        modal: {
          ondismiss: function () { setPaymentLoading(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        alert(`Payment failed: ${response.error.description}`);
        setPaymentLoading(false);
      });
      rzp.open();
      setPaymentLoading(false);
    } catch (err) {
      console.error("Error creating order:", err);
      alert("Could not initiate payment. Please try again.");
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin inline-block" />
      </div>
    );
  }

  // ── POST-PURCHASE PREMIUM DASHBOARD ──
  if (isPremium) {
    const tier = TIER_CONFIG[membershipType] || TIER_CONFIG.silver;
    const memberSince = user?.data?.createdAt
      ? new Date(user.data.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "—";

    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 animate-fade-in-up">
        {/* ── Hero ── */}
        <div className="glass-card rounded-2xl p-8 gradient-border mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <VerifiedBadge className="w-10 h-10" />
            <h1 className="text-3xl font-bold gradient-text">Premium Member</h1>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r ${tier.gradient} text-white`}>
              {tier.emoji} {tier.label}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Active
            </span>
          </div>
        </div>

        {/* ── Benefits Grid ── */}
        <div className="glass-card rounded-2xl p-6 gradient-border mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🎁</span> Your Benefits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tier.benefits.map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-base flex-shrink-0">
                  {benefit.icon}
                </div>
                <span className="text-sm text-slate-300 font-medium">{benefit.text}</span>
                <svg className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily Limits ── */}
        <div className="glass-card rounded-2xl p-6 gradient-border mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span> Daily Limits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Requests */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400 font-medium">Connection Requests</span>
                <span className="text-sm font-bold text-purple-400">{tier.limits.requests.label}</span>
              </div>
              {tier.limits.requests.total ? (
                <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                    style={{ width: "100%" }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                  <span className="text-[10px] text-purple-300 font-medium">∞</span>
                </div>
              )}
              <p className="text-[10px] text-slate-600 mt-2">
                {tier.limits.requests.total
                  ? `${tier.limits.requests.total} requests available every day`
                  : "No daily limit — send as many as you want"}
              </p>
            </div>

            {/* Messages */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400 font-medium">Chat Messages</span>
                <span className="text-sm font-bold text-blue-400">{tier.limits.messages.label}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-1000"
                  style={{ width: "100%" }}
                />
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                {tier.limits.messages.total
                  ? `${tier.limits.messages.total.toLocaleString()} messages available every day`
                  : "No daily limit"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Membership Info ── */}
        <div className="glass-card rounded-2xl p-6 gradient-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">ℹ️</span> Membership Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tier</p>
              <p className="text-lg font-bold text-white">{tier.emoji} {tier.label}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <p className="text-lg font-bold text-emerald-400">Active</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Member Since</p>
              <p className="text-lg font-bold text-white">{memberSince}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PRE-PURCHASE: PRICING CARDS ──
  return (
    <div className="w-full max-w-3xl mx-auto py-10 px-4 animate-fade-in-up">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">💎</div>
        <h1 className="text-4xl font-bold gradient-text mb-2">Go Premium</h1>
        <p className="text-slate-400">Unlock the full DevTinder experience</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Silver Card */}
        <div className="glass-card rounded-2xl p-8 gradient-border group hover:scale-[1.02] transition-all duration-300">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}
            >
              <span className="text-2xl">🥈</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Silver</h2>
            <p className="text-slate-400 text-sm mt-1">Great for getting started</p>
          </div>

          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> 100 connection requests per day
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> 1,000 messages per day
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Blue verified tick for 1 year
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Priority in feed
            </li>
          </ul>

          <button
            onClick={() => buyMembership("silver")}
            disabled={paymentLoading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}
            onMouseOver={(e) => { if (!paymentLoading) { e.target.style.boxShadow = '0 0 20px rgba(148,163,184,0.4)'; e.target.style.transform = 'translateY(-1px)' } }}
            onMouseOut={(e) => { e.target.style.boxShadow = 'none'; e.target.style.transform = 'translateY(0)' }}
          >
            {paymentLoading ? "Processing..." : "Get Silver →"}
          </button>
        </div>

        {/* Gold Card */}
        <div className="relative glass-card rounded-2xl p-8 gradient-border group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-4 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              ⭐ MOST POPULAR
            </span>
          </div>

          <div className="text-center mb-6 mt-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <span className="text-2xl">🥇</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Gold</h2>
            <p className="text-slate-400 text-sm mt-1">For power networkers</p>
          </div>

          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Unlimited connection requests
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> 10,000 messages per day
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Blue verified tick for 2 years
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Priority in feed
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> See who liked you
            </li>
            <li className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="text-emerald-400">✓</span> Advanced filters
            </li>
          </ul>

          <button
            onClick={() => buyMembership("gold")}
            disabled={paymentLoading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            onMouseOver={(e) => { if (!paymentLoading) { e.target.style.boxShadow = '0 0 20px rgba(245,158,11,0.4)'; e.target.style.transform = 'translateY(-1px)' } }}
            onMouseOut={(e) => { e.target.style.boxShadow = 'none'; e.target.style.transform = 'translateY(0)' }}
          >
            {paymentLoading ? "Processing..." : "Get Gold →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Premium;
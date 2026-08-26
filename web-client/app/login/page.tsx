"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Activity, Lock, Mail, Eye, EyeOff, X } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  
  // State for the legal modal
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  // Helper to render the modal so we don't clutter the main JSX
  const renderModal = () => {
    if (!activeModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">
              {activeModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </h2>
            <button 
              onClick={() => setActiveModal(null)}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto text-sm text-slate-600 space-y-4">
            {activeModal === 'privacy' && (
              <>
                <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
                <p>Welcome to Afya-Stock AI. We are committed to protecting your personal information and your right to privacy.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">1. Information We Collect</h3>
                <p>We collect personal information that you voluntarily provide to us when you register on the application, including your name, email address, and authentication credentials. We also securely process inventory and supply chain data uploaded to our machine learning forecasting engines.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">2. How We Use Your Information</h3>
                <p>We use the information we collect to facilitate account creation and logon processes, deliver AI-driven forecasting services to you, send administrative information, and ensure the security of our platform.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">3. Information Sharing</h3>
                <p>We only share information with your consent, to comply with laws, to provide you with services (e.g., our cloud hosting and database providers), to protect your rights, or to fulfill business obligations. We do not sell your data.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">4. Data Security</h3>
                <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards, no internet transmission is 100% secure.</p>
              </>
            )}
            {activeModal === 'terms' && (
              <>
                <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
                <p>Please read these Terms of Service carefully before using Afya-Stock AI.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">1. Acceptance of Terms</h3>
                <p>By accessing or using Afya-Stock AI, you agree to be bound by these terms. If you disagree with any part of the terms, you may not access the service.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">2. Use of the Service</h3>
                <p>You agree to use the service only for lawful purposes related to inventory and supply chain management. You are responsible for safeguarding the password that you use to access the service.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">3. Medical Supply Chain Disclaimer (Important)</h3>
                <p><strong>Afya-Stock AI is a decision-support tool.</strong> Our machine learning algorithms provide estimates and forecasts regarding medical stock levels. These forecasts are not guarantees. The service is strictly intended to assist, not replace, professional human oversight in procurement. We are not liable for any stock-outs, medical emergencies, or damages resulting from over-reliance on our automated forecasts.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">4. Limitation of Liability</h3>
                <p>In no event shall Afya-Stock AI, nor its developers or partners, be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the service.</p>
                <h3 className="text-base font-bold text-slate-800 pt-2">5. Governing Law</h3>
                <p>These Terms shall be governed and construed in accordance with the laws of Kenya, without regard to its conflict of law provisions.</p>
              </>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-right flex-shrink-0">
            <button 
              onClick={() => setActiveModal(null)}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
              <Activity size={32} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">System Login</h2>
          <p className="text-center text-slate-500 text-sm mb-8">Authenticate to access Afya-Stock AI</p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-semibold rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="procurement@hospital.org"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 bg-white text-black placeholder:text-slate-400 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all [&:-webkit-autofill]:[-webkit-text-fill-color:black] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0px_1000px_white_inset]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md disabled:opacity-70"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
  
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <Link href="/signup" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* MINIMAL AUTH FOOTER WITH MODAL TRIGGERS */}
      <footer className="w-full pt-8 pb-4 text-center text-sm text-slate-500 mt-auto">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <button onClick={() => setActiveModal('privacy')} className="hover:text-emerald-600 transition-colors">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setActiveModal('terms')} className="hover:text-emerald-600 transition-colors">Terms of Service</button>
        </div>
        <p>© {new Date().getFullYear()} Afya-Stock AI. All rights reserved.</p>
      </footer>
       
      {/* RENDER THE OVERLAY */}
      {renderModal()}
    </div>
  );
}
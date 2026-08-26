"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Activity, Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      
      {/* MAIN CONTENT AREA */}
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

      {/* MINIMAL AUTH FOOTER */}
      <footer className="w-full pt-8 pb-4 text-center text-sm text-slate-500 mt-auto">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link href="#" className="hover:text-emerald-600 transition-colors">Help Center</Link>
        </div>
        <p>© {new Date().getFullYear()} Afya-Stock AI. All rights reserved.</p>
      </footer>
       
    </div>
  );
}
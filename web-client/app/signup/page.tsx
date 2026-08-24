"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Activity, Lock, Mail, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'procurement_manager'  
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else { 
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
              <Mail size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Check your email</h2>
          <p className="text-slate-600 mb-8">
            We've sent a verification link to <span className="font-bold text-slate-900">{email}</span>.
            Please click the link to activate your account.
          </p>
          <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
            <Activity size={32} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Create Account</h2>
        <p className="text-center text-slate-500 text-sm mb-8">Register to access the Triage Dashboard</p>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-semibold rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="Jane Doe"
              />
            </div>
          </div>

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
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? "Creating Account..." : "Register"} <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
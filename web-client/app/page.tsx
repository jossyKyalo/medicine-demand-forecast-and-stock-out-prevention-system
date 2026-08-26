"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ShieldCheck, ArrowRight, BrainCircuit, Database, X } from "lucide-react";

export default function LandingPage() {
  // State to control which modal is open ('privacy', 'terms', or null for closed)
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <div className="relative min-h-screen flex flex-col text-slate-800 font-sans overflow-x-hidden">
       
      {/* Background Video */}
      <div className="fixed inset-0 -z-20 w-full h-full bg-slate-900">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/background-video.mp4" type="video/mp4" />
        </video>
      </div> 

      <div className="fixed inset-0 -z-10 bg-white/50 backdrop-blur-[2px]"></div>
 
      {/* Main Content Area */}
      <main className="flex-1 relative z-10 w-full max-w-4xl mx-auto px-6 py-24 text-center flex flex-col items-center justify-center">
         
        <div className="mb-6 inline-flex items-center justify-center p-4 bg-emerald-100/70 rounded-2xl shadow-sm border border-emerald-200/50 text-emerald-700 backdrop-blur-md">
          <Activity size={48} strokeWidth={1.5} />
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 drop-shadow-sm">
          Predictive <span className="text-emerald-700">Stock-Out</span> Prevention
        </h1>
        
        <p className="text-lg md:text-xl text-slate-800 mb-10 max-w-2xl leading-relaxed font-semibold drop-shadow-sm">
          Secure your medical supply chain. Our machine learning inference engine analyzes daily demand and supplier lead times to prevent critical shortages before they happen.
        </p>
 
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link 
            href="/login"
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-bold text-white bg-emerald-600 rounded-xl overflow-hidden transition-all hover:bg-emerald-700 shadow-lg hover:shadow-emerald-600/30"
          >
            Launch Afya-Stock AI  
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <a 
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://medicine-demand-forecast-and-stock-out-9qje.onrender.com' ||'http://localhost:8000'}/docs`}
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-800 bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl hover:border-emerald-600 hover:text-emerald-700 transition-all shadow-sm"
          >
            View API Documentation
          </a>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-lg text-left">
            <BrainCircuit className="text-emerald-600 mb-3" size={28} />
            <h3 className="font-bold text-slate-900 text-lg mb-2">ML Forecasting</h3>
            <p className="text-sm text-slate-700 font-medium">Trains on historical consumption to map 30-day forward demand trajectories.</p>
          </div>
          
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-lg text-left">
            <ShieldCheck className="text-emerald-600 mb-3" size={28} />
            <h3 className="font-bold text-slate-900 text-lg mb-2">Lead Time Defense</h3>
            <p className="text-sm text-slate-700 font-medium">Automatically alerts procurement teams before days-to-depletion breaches supplier SLA.</p>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-lg text-left">
            <Database className="text-emerald-600 mb-3" size={28} />
            <h3 className="font-bold text-slate-900 text-lg mb-2">Seamless Integration</h3>
            <p className="text-sm text-slate-700 font-medium">Connects directly to your existing inventory database via secure REST API endpoints.</p>
          </div>
        </div>
      </main>

      {/* The Solid Emerald-600 Footer */}
      <footer className="relative z-10 w-full bg-emerald-600 pt-16 pb-8 px-6 mt-auto text-white shadow-[0_-10px_30px_rgba(5,150,105,0.2)]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-10 mb-12">
          
          <div className="max-w-sm text-left">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-white" size={24} />
              <span className="text-xl font-extrabold text-white tracking-wide">
                Afya-Stock AI
              </span>
            </div>
            <p className="text-emerald-100 text-sm leading-relaxed font-medium">
              Predictive medical stock-out prevention and intelligent purchase order management. Securing health supply chains with machine learning.
            </p>
          </div>

          <div className="flex flex-wrap gap-16 text-left">
            <div>
              <h4 className="text-emerald-50 font-bold mb-4 tracking-wide uppercase text-xs">Platform</h4>
              <ul className="space-y-3 text-sm text-emerald-100 font-medium">
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Register Account</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-emerald-50 font-bold mb-4 tracking-wide uppercase text-xs">Developers</h4>
              <ul className="space-y-3 text-sm text-emerald-100 font-medium">
                <li>
                  <a 
                    href={`${process.env.NEXT_PUBLIC_API_BASE_URL||'https://medicine-demand-forecast-and-stock-out-9qje.onrender.com' || 'http://localhost:8000'}/docs`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    API Documentation
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto border-t border-emerald-500 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-emerald-100">
          <p>© {new Date().getFullYear()} Afya-Stock AI. All rights reserved.</p>
          <div className="flex gap-6">
            <button onClick={() => setActiveModal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={() => setActiveModal('terms')} className="hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>

      {/* MODAL OVERLAY */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
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

            {/* Modal Content (Scrollable) */}
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

            {/* Modal Footer */}
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
      )}

    </div>
  );
}
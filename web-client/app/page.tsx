import Link from "next/link";
import { Activity, ShieldCheck, ArrowRight, BrainCircuit, Database } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center text-slate-800 font-sans overflow-hidden">
       
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
 
      <div className="relative z-10 w-full max-w-4xl px-6 text-center flex flex-col items-center">
         
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
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/docs`}
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

      </div>
    </div>
  );
}
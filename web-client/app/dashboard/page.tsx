"use client";

import { useState, useEffect } from "react";
import {
  Activity, ShieldAlert, PackageCheck, AlertCircle,
  CheckCircle2, Stethoscope, FileText, TrendingDown,
  X, ShoppingCart, Plus, LogOut, ChevronRight, UploadCloud
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Papa from "papaparse";

interface PredictionData {
  sku: string;
  name: string;
  days_to_depletion: number;
  stockout_risk: string;
  reorder_recommended: boolean;
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const [selectedPO, setSelectedPO] = useState<PredictionData | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(500);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    name: "",
    sku: "",
    currentStock: "",
    dailyDemand: "",
    leadTime: ""
  });

  const router = useRouter();
  const supabase = createClient();

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 1. UPDATED: Fetch real data from Supabase
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        // If no data exists, trigger the onboarding screen
        if (!data || data.length === 0) {
          setNeedsOnboarding(true);
          setLoading(false);
        } else {
          // Map DB columns to UI state (we will hook this to FastAPI next!)
          const formattedData = data.map(item => ({
            sku: item.sku || "N/A",
            name: item.medicine,
            days_to_depletion: Math.floor((item.closing_stock || 0) / (item.expected_demand || 1)),
            stockout_risk: "Pending AI Analysis", // Placeholder until batch inference
            reorder_recommended: false
          }));

          setPredictions(formattedData);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
        setLoading(false);
      }
    };

    fetchInventory();
  }, [router, supabase]);

  // 2. NEW: Handle CSV Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Format the CSV rows and clean empty strings for the database
        const formattedData = results.data.map((row: any) => {
          const cleanedRow: any = { ...row };

          // Loop through every column and convert "" to null to prevent BigInt errors
          for (const key in cleanedRow) {
            if (cleanedRow[key] === "") {
              cleanedRow[key] = null;
            }
          }

          cleanedRow.user_id = user?.id;
          cleanedRow.sku = row.sku || `${String(row.medicine).substring(0, 3).toUpperCase()}-100`;

          return cleanedRow;
        });

        // Insert into Supabase
        const { error } = await supabase.from('inventory').insert(formattedData);

        if (!error) {
          // Map to UI and unlock dashboard
          const uiData = formattedData.map(item => ({
            sku: item.sku,
            name: item.medicine,
            days_to_depletion: Math.floor((Number(item.closing_stock) || 0) / (Number(item.expected_demand) || 1)),
            stockout_risk: "Pending AI Analysis",
            reorder_recommended: false
          }));

          setPredictions(uiData);
          setNeedsOnboarding(false);
        } else {
          console.error("Upload Error:", error);
          alert("Failed to upload data to database.");
        }
        setLoading(false);
      }
    });
  };

  const criticalCount = predictions.filter(p => p.stockout_risk === "Critical").length;
  const warningCount = predictions.filter(p => p.stockout_risk === "Warning").length;

  const openPOModal = (item: PredictionData) => {
    setSelectedPO(item);
    setOrderQuantity(item.days_to_depletion < 5 ? 1000 : 500);
  };

  const closePOModal = () => setSelectedPO(null);

  const handleManualInference = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/predict/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualData.name,
          sku: manualData.sku,
          currentStock: Number(manualData.currentStock),
          dailyDemand: Number(manualData.dailyDemand),
          leadTime: Number(manualData.leadTime)
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const newPrediction: PredictionData = await response.json();

      setPredictions([newPrediction, ...predictions]);
      setManualData({ name: "", sku: "", currentStock: "", dailyDemand: "", leadTime: "" });
      setIsManualModalOpen(false);

    } catch (error) {
      console.error("Failed to fetch prediction:", error);
      alert("Unable to connect to the Inference Engine. Ensure your FastAPI server is running.");
    }
  };

  // 3. NEW: The Onboarding UI Block
  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900"></div>

        <div className="bg-slate-800/50 backdrop-blur-xl p-10 rounded-3xl border border-slate-700 max-w-lg text-center shadow-2xl">
          <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <PackageCheck size={40} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold mb-3 tracking-tight">Welcome to Triage</h1>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">
            Your dashboard is currently empty. Upload your facility's historical inventory data (CSV) to initialize your predictive AI models.
          </p>

          <label className="bg-emerald-600 hover:bg-emerald-500 cursor-pointer px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-900/50 flex items-center justify-center gap-3 w-full group">
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <>
                <UploadCloud size={20} className="group-hover:-translate-y-1 transition-transform" />
                Upload Inventory CSV
              </>
            )}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
          </label>

          <button onClick={handleLogOut} className="mt-6 text-sm text-slate-500 hover:text-slate-300 font-medium">
            Sign out instead
          </button>
        </div>
      </div>
    );
  }

  // ... The rest of your existing Dashboard return statement starts here
  return (
    <div className="relative min-h-screen text-slate-800 font-sans selection:bg-emerald-200 overflow-hidden">
      <div className="fixed inset-0 -z-20 w-full h-full bg-slate-900">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80">
          <source src="dashboard-background-video.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="fixed inset-0 -z-10 bg-slate-50/80 backdrop-blur-sm"></div>

      <div className="p-6 md:p-8 relative z-10 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-emerald-900/95 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-emerald-700/50 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-400/20 p-3.5 rounded-2xl border border-emerald-400/30 shadow-inner">
              <Stethoscope size={28} className="text-emerald-100" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Triage Dashboard</h1>
              <p className="text-emerald-200/80 text-sm mt-0.5 font-medium">Predictive Stock-Out Prevention Engine</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-emerald-800/50 text-emerald-50 border border-emerald-600/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} /> Manual Input
            </button>
            <button className="bg-white text-emerald-900 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-2 active:scale-95">
              <FileText size={16} /> Export Report
            </button>
            <button
              onClick={handleLogOut}
              className="bg-transparent text-emerald-200 border border-emerald-700/50 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-rose-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-rose-600 group-hover:scale-110 transition-transform duration-500"><TrendingDown size={120} /></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Critical Risk</h3>
              <div className="bg-rose-100/80 text-rose-600 p-2.5 rounded-xl shadow-sm border border-rose-200/50"><ShieldAlert size={20} strokeWidth={2.5} /></div>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-black text-slate-900 tracking-tight">{criticalCount}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">SKUs depleting before lead time</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-amber-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-amber-600 group-hover:scale-110 transition-transform duration-500"><AlertCircle size={120} /></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Approaching Buffer</h3>
              <div className="bg-amber-100/80 text-amber-700 p-2.5 rounded-xl shadow-sm border border-amber-200/50"><AlertCircle size={20} strokeWidth={2.5} /></div>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-black text-slate-900 tracking-tight">{warningCount}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">Within 7-day safety threshold</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-emerald-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-emerald-600 group-hover:scale-110 transition-transform duration-500"><PackageCheck size={120} /></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Total Monitored</h3>
              <div className="bg-emerald-100/80 text-emerald-700 p-2.5 rounded-xl shadow-sm border border-emerald-200/50"><PackageCheck size={20} strokeWidth={2.5} /></div>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-black text-slate-900 tracking-tight">{predictions.length}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">Active catalog items tracked</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700"><Activity size={18} strokeWidth={2.5} /></div>
              <h2 className="text-lg font-extrabold text-slate-900">Inference Results</h2>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mb-4"></div>
              <p className="text-slate-500 font-medium">Querying database...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Medication & SKU</th>
                    <th className="px-6 py-4 font-bold">Depletion Horizon</th>
                    <th className="px-6 py-4 font-bold">Risk Assessment</th>
                    <th className="px-6 py-4 font-bold text-right">Procurement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {predictions.map((item) => (
                    <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-base">{item.name}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">{item.sku}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 w-32">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-slate-900">{item.days_to_depletion}</span>
                            <span className="text-slate-500 font-medium text-xs">days left</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.days_to_depletion < 7 ? 'bg-rose-500' : item.days_to_depletion < 15 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min((item.days_to_depletion / 60) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border 
                          ${item.stockout_risk === "Critical" ? "bg-rose-50 text-rose-700 border-rose-200/70" :
                            item.stockout_risk === "Warning" ? "bg-amber-50 text-amber-700 border-amber-200/70" :
                              item.stockout_risk === "Safe" ? "bg-emerald-50 text-emerald-700 border-emerald-200/70" :
                                "bg-slate-50 text-slate-700 border-slate-200/70" // Catch-all for "Pending"
                          }`}>
                          {item.stockout_risk === "Critical" && <ShieldAlert size={14} />}
                          {item.stockout_risk === "Warning" && <AlertCircle size={14} />}
                          {item.stockout_risk === "Safe" && <CheckCircle2 size={14} />}
                          {item.stockout_risk}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.reorder_recommended ? (
                          <button
                            onClick={() => openPOModal(item)}
                            className="bg-slate-900 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 ml-auto active:scale-95"
                          >
                            <ShoppingCart size={14} /> Draft PO <ChevronRight size={14} className="opacity-70" />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold px-4 flex items-center justify-end gap-1.5">
                            <CheckCircle2 size={14} /> Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals remain exactly the same */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Purchase Order</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">Ref: PO-{Math.floor(Math.random() * 100000)} • Auto-Generated</p>
              </div>
              <button onClick={closePOModal} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200 p-2.5 rounded-full transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Target SKU</p>
                  <p className="text-lg font-bold text-slate-900">{selectedPO.name}</p>
                  <p className="text-sm text-slate-500 font-medium">{selectedPO.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Time</p>
                  <p className="text-lg font-bold text-slate-900">7 Days</p>
                </div>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex gap-4">
                <div className="bg-emerald-100 p-2 rounded-xl h-fit text-emerald-600"><Activity size={20} /></div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Model Recommendation</h4>
                  <p className="text-sm text-emerald-800/80 mt-1.5 leading-relaxed">
                    Predicted depletion in <span className="font-bold">{selectedPO.days_to_depletion} days</span>. Reordering {orderQuantity} units mitigates 30-day stock-out risk.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Quantity (Units)</label>
                <input
                  type="number"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-black text-lg font-bold rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block p-3.5 shadow-sm transition-all outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
              <button onClick={closePOModal} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm active:scale-95">
                Cancel
              </button>
              <button onClick={() => { alert("PO Submitted"); closePOModal(); }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 active:scale-95">
                Execute Order
              </button>
            </div>
          </div>
        </div>
      )}

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Run Inference</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">Test real-time predictions</p>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200 p-2.5 rounded-full transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleManualInference} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Medication Name</label>
                  <input required type="text" value={manualData.name} onChange={e => setManualData({ ...manualData, name: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" placeholder="e.g. Insulin" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">SKU</label>
                  <input required type="text" value={manualData.sku} onChange={e => setManualData({ ...manualData, sku: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" placeholder="INS-100" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Stock</label>
                  <input required type="number" value={manualData.currentStock} onChange={e => setManualData({ ...manualData, currentStock: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Daily Demand</label>
                  <input required type="number" value={manualData.dailyDemand} onChange={e => setManualData({ ...manualData, dailyDemand: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Lead (Days)</label>
                  <input required type="number" value={manualData.leadTime} onChange={e => setManualData({ ...manualData, leadTime: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 shadow-sm active:scale-95 transition-all">Cancel</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-emerald-600 flex items-center gap-2 shadow-md active:scale-95 transition-all">
                  <Activity size={16} /> Predict
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
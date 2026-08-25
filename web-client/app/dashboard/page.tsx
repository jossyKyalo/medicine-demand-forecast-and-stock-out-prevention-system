"use client";

import { useState, useEffect } from "react";
import {
  Activity, ShieldAlert, PackageCheck, AlertCircle,
  CheckCircle2, Stethoscope, FileText, TrendingDown,
  X, ShoppingCart, Plus, LogOut, ChevronRight, UploadCloud, AlertTriangle, Download, Info, Check
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Papa from "papaparse";

interface PredictionData {
  id: string;
  sku: string;
  name: string;
  days_to_depletion: number;
  stockout_risk: string;
  reorder_recommended: boolean;
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for CSV Upload Instructions
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);

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
    try { 
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error.message); 
        localStorage.clear();
      }
 
      router.refresh();
 
      router.replace("/login");

    } catch (err) {
      console.error("Unexpected error during sign out:", err); 
      window.location.href = "/login";
    }
  };

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

        if (data && data.length > 0) {
          const formattedData = data.map(item => ({
            id: item.record_id || Math.random().toString(),
            sku: item.sku || "N/A",
            name: item.medicine,
            days_to_depletion: Math.floor((item.closing_stock || 0) / (item.expected_demand || 1)),
            stockout_risk: "Pending AI Analysis",
            reorder_recommended: false
          }));
          setPredictions(formattedData);
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
        setLoading(false);
      }
    };

    fetchInventory();
  }, [router, supabase]);

  const downloadCsvTemplate = () => {
    const columns = [
      "record_id", "date", "year", "month", "quarter", "week_of_year", "day_of_week",
      "facility_type", "facility_size", "facility_location", "medicine", "medicine_dosage_form",
      "registered_patients", "outpatient_visits", "prescriptions_issued", "expected_demand",
      "previous_day_demand", "previous_week_demand", "demand_7_days_avg", "demand_14_days_avg",
      "demand_30_days_avg", "demand_90_days_avg", "opening_stock", "stock_received", "stock_adjustments",
      "dispensed_quantity", "closing_stock", "stock_out", "stock_out_days", "lost_demand_units",
      "supplier_type", "supplier_reliability", "lead_time_days", "purchase_orders", "purchase_order_quantity",
      "order_delay_days", "safety_stock", "reorder_point", "reorder_flag", "inventory_value_kes",
      "expiry_risk", "expired_quantity", "damaged_quantity", "unit_cost_kes", "inventory_turnover",
      "demand_supply_ratio", "adjusted_demand", "forecast_next_7_days", "forecast_next_14_days",
      "forecast_next_30_days", "forecast_error", "forecast_error_percentage", "stockout_within_30_days"
    ];

    const csvContent = "data:text/csv;charset=utf-8," + columns.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "triage_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Mark that they have downloaded the template
    setHasDownloadedTemplate(true);
  };

  const handleFileUploadTrigger = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setNotification(null);
    setIsUploadModalOpen(false); // Close instructions modal

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const formattedData = results.data.map((row: any) => {
            const cleanedRow: any = { ...row };
            for (const key in cleanedRow) {
              if (cleanedRow[key] === "") {
                cleanedRow[key] = null;
              }
            }
            cleanedRow.user_id = user?.id;
            cleanedRow.sku = row.sku || `${String(row.medicine || 'MED').substring(0, 3).toUpperCase()}-100`;
            return cleanedRow;
          });

          const { error } = await supabase
            .from('inventory')
            .upsert(formattedData, { onConflict: 'record_id' });

          if (!error) {
            const uiData = formattedData.map(item => ({
              id: item.record_id || Math.random().toString(),
              sku: item.sku,
              name: item.medicine,
              days_to_depletion: Math.floor((Number(item.closing_stock) || 0) / (Number(item.expected_demand) || 1)),
              stockout_risk: "Pending AI Analysis",
              reorder_recommended: false
            }));
            setPredictions(uiData);
            setNotification({
              type: 'success',
              text: 'Batch inventory uploaded successfully! New stock metrics have been synchronized.'
            });
          } else {
            console.error("Upload Error:", error);
            setNotification({
              type: 'error',
              text: 'Some medicines in this batch are already tracked or required fields are missing.'
            });
          }
          setLoading(false);
        }
      });
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
    setNotification(null);

    try {
      // 1. Send data to FastAPI for the prediction
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

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      // The AI prediction results (e.g., stockout_risk)
      const aiResult = await response.json(); 

      // 2. Format the data for Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const newRecordId = `MANUAL-${Date.now()}`; // Generate a unique ID for manual entries

      const dbRecord = {
        user_id: user?.id,
        record_id: newRecordId,
        sku: manualData.sku,
        medicine: manualData.name,
        closing_stock: Number(manualData.currentStock),
        expected_demand: Number(manualData.dailyDemand),
        lead_time_days: Number(manualData.leadTime),
        // We leave the rest of the 50 columns blank for manual entries!
      };

      // 3. Save to Supabase
      const { error } = await supabase.from('inventory').insert([dbRecord]);

      if (error) throw error;

      // 4. Update the UI immediately so the user sees it
      const newUIRow: PredictionData = {
        id: newRecordId,
        sku: manualData.sku,
        name: manualData.name,
        days_to_depletion: Math.floor(Number(manualData.currentStock) / Number(manualData.dailyDemand)),
        stockout_risk: aiResult.stockout_risk || "Pending", 
        reorder_recommended: aiResult.reorder_recommended || false
      };

      setPredictions([newUIRow, ...predictions]);
      
      // 5. Clean up and show success message
      setManualData({ name: "", sku: "", currentStock: "", dailyDemand: "", leadTime: "" });
      setIsManualModalOpen(false);
      setNotification({
        type: 'success',
        text: `${manualData.name} prediction completed and saved to your dashboard!`
      });

    } catch (error) {
      console.error("Failed to process manual prediction:", error);
      setNotification({
        type: 'error',
        text: 'Failed to run prediction or save to database. Ensure your backend is running.'
      });
    }
  };

  return (
    <div className="relative min-h-screen text-slate-800 font-sans selection:bg-emerald-200 overflow-hidden">
      <div className="fixed inset-0 -z-20 w-full h-full bg-slate-900">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80">
          <source src="dashboard-background-video.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="fixed inset-0 -z-10 bg-slate-50/80 backdrop-blur-sm"></div>

      <div className="p-6 md:p-8 relative z-10 max-w-7xl mx-auto">

        {notification && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between border shadow-lg backdrop-xl transition-all animate-in fade-in duration-300 ${notification.type === 'success'
              ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700'
              : 'bg-amber-900/90 text-amber-100 border-amber-700'
            }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={20} className="text-amber-400 shrink-0" />}
              <p className="text-sm font-semibold">{notification.text}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-white/70 hover:text-white p-1 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>
        )}

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
            {/* Opens Instructions Modal Instead of File Picker Directly */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-emerald-800/50 text-emerald-50 border border-emerald-600/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <UploadCloud size={16} /> Upload Batch CSV
            </button>

            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-emerald-800/50 text-emerald-50 border border-emerald-600/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} /> Manual Input
            </button>
            <button
              onClick={handleLogOut}
              className="bg-transparent text-emerald-200 border border-emerald-700/50 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-rose-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-rose-600"><TrendingDown size={120} /></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Critical Risk</h3>
              <div className="bg-rose-100/80 text-rose-600 p-2.5 rounded-xl shadow-sm border border-rose-200/50"><ShieldAlert size={20} strokeWidth={2.5} /></div>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-black text-slate-900 tracking-tight">{criticalCount}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">SKUs depleting before lead time</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-amber-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-amber-600"><AlertCircle size={120} /></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Approaching Buffer</h3>
              <div className="bg-amber-100/80 text-amber-700 p-2.5 rounded-xl shadow-sm border border-amber-200/50"><AlertCircle size={20} strokeWidth={2.5} /></div>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-black text-slate-900 tracking-tight">{warningCount}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">Within 7-day safety threshold</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-emerald-50/50 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] text-emerald-600"><PackageCheck size={120} /></div>
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

        {/* Results Table */}
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
          ) : predictions.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-slate-500 font-medium mb-2">No inventory data found for this account.</p>
              <p className="text-xs text-slate-400">Click "Upload Batch CSV" above to review instructions and template requirements.</p>
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
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
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
                                "bg-slate-50 text-slate-700 border-slate-200/70"
                          }`}>
                          {item.stockout_risk}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.reorder_recommended ? (
                          <button
                            onClick={() => openPOModal(item)}
                            className="bg-slate-900 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ml-auto active:scale-95"
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

      {/* CSV Upload Instructions & Requirement Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-700"><Info size={22} /></div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Batch Upload Guidelines</h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Please review instructions before proceeding</p>
                </div>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200 p-2.5 rounded-full transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-slate-600 text-sm">
              <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl flex gap-3 text-amber-900">
                <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">
                  <strong>Important:</strong> Your file must match the required schema. We strongly recommend downloading our official template if you haven't already.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Instructions:</h4>
                <ul className="space-y-3 text-xs font-medium">
                  <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded shrink-0">1</span>
                    <p className="leading-relaxed">
                      Fill out all required inventory fields (such as <code className="text-emerald-700 font-bold">record_id</code>, <code className="text-emerald-700 font-bold">medicine</code>, <code className="text-emerald-700 font-bold">closing_stock</code>, and <code className="text-emerald-700 font-bold">expected_demand</code>).
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded shrink-0">2</span>
                    <p className="leading-relaxed">
                      Save your document strictly as a **CSV (Comma Delimited)** file format.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded shrink-0">3</span>
                    <p className="leading-relaxed">
                      Avoid altering or deleting any of the mandatory column header names.
                    </p>
                  </li>
                </ul>
              </div>

              {/* Template Download Step */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Need the template?</p>
                  <p className="text-[11px] text-slate-500">Includes all 50+ machine learning headers</p>
                </div>
                <button
                  onClick={downloadCsvTemplate}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${hasDownloadedTemplate
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-sm'
                    }`}
                >
                  {hasDownloadedTemplate ? <><Check size={14} /> Template Downloaded</> : <><Download size={14} /> Download Template</>}
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>

              {/* Proceed to File Selection */}
              <label className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 ${hasDownloadedTemplate ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-400 hover:bg-slate-500'
                }`}>
                <UploadCloud size={16} /> Proceed to Upload
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUploadTrigger} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
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
                  <input required type="text" value={manualData.name} onChange={e => setManualData({ ...manualData, name: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" placeholder="e.g. Insulin" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">SKU</label>
                  <input required type="text" value={manualData.sku} onChange={e => setManualData({ ...manualData, sku: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" placeholder="INS-100" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Stock</label>
                  <input required type="number" value={manualData.currentStock} onChange={e => setManualData({ ...manualData, currentStock: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Daily Demand</label>
                  <input required type="number" value={manualData.dailyDemand} onChange={e => setManualData({ ...manualData, dailyDemand: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Lead (Days)</label>
                  <input required type="number" value={manualData.leadTime} onChange={e => setManualData({ ...manualData, leadTime: e.target.value })} className="w-full bg-white border border-slate-200 text-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 shadow-sm transition-all">Cancel</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-emerald-600 flex items-center gap-2 shadow-md transition-all">
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
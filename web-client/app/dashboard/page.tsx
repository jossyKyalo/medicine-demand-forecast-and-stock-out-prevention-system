"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, ShieldAlert, PackageCheck, AlertCircle, 
  CheckCircle2, Stethoscope, FileText, TrendingDown, 
  X, ShoppingCart, Plus, LogOut, ChevronRight, ChevronLeft, Pencil, Trash2, Save, ClipboardList, ClipboardCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface PredictionData {
  id?: number;
  sku: string;
  name: string;
  days_to_depletion: number;
  stockout_risk: string;
  reorder_recommended: boolean;
  forecast_next_7_days: number;
  source?: string;
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryItem>({
    record_id: "",
    sku: "",
    medicine: "",
    closing_stock: 0,
    demand_7_days_avg: 0,
    lead_time_days: 0,
    reorder_point: 0,
    unit_cost_kes: 0,
  });

  const [selectedPO, setSelectedPO] = useState<PredictionData | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(500);
  const [poReference, setPoReference] = useState("");
  const [activeSection, setActiveSection] = useState<"inference" | "records" | "orders">("inference");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [inferencePage, setInferencePage] = useState(1);
  const [inferencePageSize, setInferencePageSize] = useState(5);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    name: "",
    sku: "",
    currentStock: "",
    dailyDemand: "",
    leadTime: ""
  });

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const handleDatasetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/v1/predict/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail ?? `API Error: ${response.status}`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired.");
      const uploadedInventory = (result.inventory_records ?? []) as InventoryItem[];
      if (uploadedInventory.length > 0) {
        const { error: inventorySaveError } = await supabase
          .from("inventory")
          .upsert(uploadedInventory, { onConflict: "record_id" });
        if (inventorySaveError) throw new Error(`Predictions generated, but inventory was not saved: ${inventorySaveError.message}`);
        await loadInventory();
      }
      const rowsToSave = result.predictions.map((prediction: PredictionData) => ({
        ...prediction,
        user_id: user.id,
        source: `upload:${file.name}`,
      }));
      const { data: savedPredictions, error } = await supabase
        .from("predictions")
        .insert(rowsToSave)
        .select("id, sku, name, days_to_depletion, stockout_risk, reorder_recommended, forecast_next_7_days, source");
      if (error) {
        setNotice(`Predictions generated, but not saved: ${error.message}. Run supabase/predictions.sql to enable history.`);
        setPredictions([...result.predictions, ...predictions]);
      } else {
        setPredictions([...(savedPredictions ?? result.predictions), ...predictions]);
      }
    } catch (error) {
      console.error("Failed to upload dataset:", error);
      alert(error instanceof Error ? error.message : "Unable to process the dataset.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, po_reference, sku, medicine, quantity, days_to_depletion, status, created_at")
      .order("created_at", { ascending: false });
    if (error) setNotice(`Orders are unavailable: ${error.message}. Run supabase/predictions.sql to enable order tracking.`);
    else setOrders(data ?? []);
    setOrdersLoading(false);
  }, [supabase]);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    const { data, error } = await supabase.from("inventory").select(inventoryFields).limit(1000);
    if (error) setInventoryError(error.message);
    else setInventory(data ?? []);
    setInventoryLoading(false);
  }, [supabase]);

  const startInventoryEdit = (item: InventoryItem) => {
    setEditingRecord(item.record_id);
    setInventoryForm(item);
  };

  const cancelInventoryEdit = () => {
    setEditingRecord(null);
    setInventoryForm({ record_id: "", sku: "", medicine: "", closing_stock: 0, demand_7_days_avg: 0, lead_time_days: 0, reorder_point: 0, unit_cost_kes: 0 });
  };

  const saveInventory = async () => {
    const request = editingRecord
      ? supabase.from("inventory").update(inventoryForm).eq("record_id", editingRecord)
      : supabase.from("inventory").insert(inventoryForm);
    const { error } = await request;
    if (error) {
      setInventoryError(error.message);
      return;
    }
    cancelInventoryEdit();
    await loadInventory();
  };

  const deleteInventory = async (recordId: string) => {
    if (!window.confirm("Delete this inventory record? This cannot be undone.")) return;
    const { error } = await supabase.from("inventory").delete().eq("record_id", recordId);
    if (error) setInventoryError(error.message);
    else await loadInventory();
  };

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        await loadInventory();
        await loadOrders();

        const { data: savedPredictions, error: savedError } = await supabase
          .from("predictions")
          .select("id, sku, name, days_to_depletion, stockout_risk, reorder_recommended, forecast_next_7_days, source")
          .order("created_at", { ascending: false });
        if (savedError) {
          setNotice(`Prediction history is unavailable: ${savedError.message}. Showing live results only.`);
        }
        if (savedPredictions && savedPredictions.length > 0) {
          setPredictions(savedPredictions);
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/predict/dataset?limit=10`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const datasetPredictions: PredictionData[] = await response.json();
        const rowsToSave = datasetPredictions.map((prediction) => ({
          ...prediction,
          user_id: user.id,
          source: "dataset",
        }));
        const { data: insertedPredictions, error: insertError } = await supabase
          .from("predictions")
          .insert(rowsToSave)
          .select("id, sku, name, days_to_depletion, stockout_risk, reorder_recommended, forecast_next_7_days, source");
        if (insertError) {
          setNotice(`Predictions generated, but not saved: ${insertError.message}. Run supabase/predictions.sql to enable history.`);
        }
        setPredictions(insertedPredictions ?? datasetPredictions);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch predictions:", error);
        setLoading(false);
      }
    };
    fetchPredictions();
  }, [loadInventory, loadOrders, router, supabase]);

  const criticalCount = predictions.filter(p => p.stockout_risk === "Critical").length;
  const warningCount = predictions.filter(p => p.stockout_risk === "Warning").length;
  const inferencePageCount = Math.max(1, Math.ceil(predictions.length / inferencePageSize));
  const currentInferencePage = Math.min(inferencePage, inferencePageCount);
  const visiblePredictions = predictions.slice(
    (currentInferencePage - 1) * inferencePageSize,
    currentInferencePage * inferencePageSize,
  );

  const openPOModal = (item: PredictionData) => {
    setSelectedPO(item);
    setPoReference(`PO-${item.sku}`);
    setOrderQuantity(item.days_to_depletion < 5 ? 1000 : 500);
  };

  const closePOModal = () => setSelectedPO(null);

  const submitOrder = async () => {
    if (!selectedPO) return;
    if (orders.some((order) => order.sku === selectedPO.sku && ["Review", "Approved"].includes(order.status))) {
      setNotice(`An active order already exists for ${selectedPO.name}. Edit or cancel it before submitting another order.`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Your session has expired. Please sign in again.");
      return;
    }
    const order: Omit<Order, "id" | "created_at"> & { user_id: string } = {
      user_id: user.id,
      po_reference: poReference,
      sku: selectedPO.sku,
      medicine: selectedPO.name,
      quantity: orderQuantity,
      days_to_depletion: selectedPO.days_to_depletion,
      status: "Review",
    };
    const { data, error } = await supabase
      .from("orders")
      .insert(order)
      .select("id, po_reference, sku, medicine, quantity, days_to_depletion, status, created_at")
      .single();
    if (error) {
      setNotice(error.code === "23505" ? `An active order already exists for ${selectedPO.name}.` : `Order was not saved: ${error.message}. Run supabase/predictions.sql to enable order tracking.`);
      return;
    }
    setOrders((currentOrders) => [data, ...currentOrders]);
    setSelectedPO(null);
    setActiveSection("orders");
  };

  const updateOrder = async () => {
    if (!editingOrder || editingOrder.quantity < 1) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ quantity: editingOrder.quantity, status: editingOrder.status })
      .eq("id", editingOrder.id)
      .select("id, po_reference, sku, medicine, quantity, days_to_depletion, status, created_at")
      .single();
    if (error) {
      setNotice(`Order was not updated: ${error.message}`);
      return;
    }
    setOrders((currentOrders) => currentOrders.map((order) => order.id === data.id ? data : order));
    setEditingOrder(null);
  };

  const deleteOrder = async (order: Order) => {
    if (!window.confirm(`Delete ${order.po_reference}? This cannot be undone.`)) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) setNotice(`Order was not deleted: ${error.message}`);
    else setOrders((currentOrders) => currentOrders.filter((item) => item.id !== order.id));
  };

  const handleManualInference = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 1. Send the data to your FastAPI backend
      const response = await fetch(`${API_BASE_URL}/api/v1/predict/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: manualData.name,
          sku: manualData.sku,
          currentStock: Number(manualData.currentStock),
          dailyDemand: Number(manualData.dailyDemand),
          leadTime: Number(manualData.leadTime)
        }),
      });

      // 2. Handle server errors (e.g., if FastAPI is down)
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail ?? `API Error: ${response.status}`);

      // 3. Parse the AI prediction sent back from Python
      const newPrediction: PredictionData = result;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired.");
      const { data: savedPrediction, error: saveError } = await supabase
        .from("predictions")
        .insert({ ...newPrediction, user_id: user.id, source: "manual" })
        .select("id, sku, name, days_to_depletion, stockout_risk, reorder_recommended, forecast_next_7_days, source")
        .single();
      if (saveError) {
        setNotice(`Prediction generated, but not saved: ${saveError.message}. Run supabase/predictions.sql to enable history.`);
      }

      // 4. Update the UI table with the new result
      setPredictions([savedPrediction ?? newPrediction, ...predictions]);
      
      // 5. Clear the form and close the modal
      setManualData({ name: "", sku: "", currentStock: "", dailyDemand: "", leadTime: "" });
      setIsManualModalOpen(false);
      
    } catch (error) {
      console.error("Failed to fetch prediction:", error);
      alert(error instanceof Error ? error.message : "Unable to run the prediction.");
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
            <input
              ref={uploadInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleDatasetUpload}
              className="hidden"
            />
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="bg-emerald-800/50 text-emerald-50 border border-emerald-600/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-60"
            >
              <FileText size={16} /> {uploading ? "Processing..." : "Upload Dataset"}
            </button>
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-emerald-800/50 text-emerald-50 border border-emerald-600/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} /> Manual Input
            </button>
            <button onClick={() => setActiveSection("orders")} className="bg-white text-emerald-900 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-2 active:scale-95">
              <ClipboardCheck size={16} /> View Orders
            </button>
            <button
              onClick={handleLogOut}
              className="bg-transparent text-emerald-200 border border-emerald-700/50 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </header>

        {notice && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notification" className="text-amber-700 hover:text-amber-900"><X size={17} /></button>
          </div>
        )}
 
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
 
        <div className="mb-4 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg p-2 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setActiveSection("inference")}
            className={`flex-1 rounded-xl px-5 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeSection === "inference" ? "bg-emerald-900 text-white shadow-md" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"}`}
          >
            <Activity size={17} /> Inference Results
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === "inference" ? "bg-white/15 text-emerald-100" : "bg-slate-100 text-slate-500"}`}>{predictions.length}</span>
          </button>
          <button
            onClick={() => setActiveSection("records")}
            className={`flex-1 rounded-xl px-5 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeSection === "records" ? "bg-emerald-900 text-white shadow-md" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"}`}
          >
            <ClipboardList size={17} /> Inventory Records
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === "records" ? "bg-white/15 text-emerald-100" : "bg-slate-100 text-slate-500"}`}>{inventory.length}</span>
          </button>
          <button
            onClick={() => setActiveSection("orders")}
            className={`flex-1 rounded-xl px-5 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeSection === "orders" ? "bg-emerald-900 text-white shadow-md" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"}`}
          >
            <ClipboardCheck size={17} /> Orders
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === "orders" ? "bg-white/15 text-emerald-100" : "bg-slate-100 text-slate-500"}`}>{orders.length}</span>
          </button>
        </div>

        {activeSection === "inference" && <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700"><Activity size={18} strokeWidth={2.5} /></div>
              <h2 className="text-lg font-extrabold text-slate-900">Inference Results</h2>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mb-4"></div>
              <p className="text-slate-500 font-medium">Querying ML predictions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Medication & SKU</th>
                    <th className="px-6 py-4 font-bold">Depletion Horizon</th>
                    <th className="px-6 py-4 font-bold">7-Day Forecast</th>
                    <th className="px-6 py-4 font-bold">Risk Assessment</th>
                    <th className="px-6 py-4 font-bold text-right">Procurement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {visiblePredictions.map((item) => (
                    <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-base">{item.name}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">{item.sku}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {item.forecast_next_7_days.toFixed(2)} units
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
                              "bg-emerald-50 text-emerald-700 border-emerald-200/70"
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
          {!loading && predictions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <label htmlFor="inference-page-size" className="text-xs font-semibold text-slate-500">Rows per page</label>
                <input
                  id="inference-page-size"
                  type="number"
                  min="1"
                  max="50"
                  value={inferencePageSize}
                  onChange={(event) => {
                    const nextSize = Math.min(50, Math.max(1, Number(event.target.value) || 1));
                    setInferencePageSize(nextSize);
                    setInferencePage(1);
                  }}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="text-xs font-semibold text-slate-500">
                Showing {(currentInferencePage - 1) * inferencePageSize + 1}-{Math.min(currentInferencePage * inferencePageSize, predictions.length)} of {predictions.length} results
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInferencePage((page) => Math.max(1, page - 1))}
                  disabled={currentInferencePage === 1}
                  aria-label="Previous inference results page"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-20 text-center text-xs font-bold text-slate-600">Page {currentInferencePage} of {inferencePageCount}</span>
                <button
                  onClick={() => setInferencePage((page) => Math.min(inferencePageCount, page + 1))}
                  disabled={currentInferencePage === inferencePageCount}
                  aria-label="Next inference results page"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        }

        {activeSection === "records" && <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Inventory Records</h2>
              <p className="text-sm text-slate-500 mt-1">Manage source records used for forecasting.</p>
            </div>
            <button onClick={cancelInventoryEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
              <Plus size={16} /> New Record
            </button>
          </div>

          {inventoryError && <p className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{inventoryError}</p>}

          {editingRecord === null && inventoryForm.record_id === "" && (
            <div className="p-6 border-b border-slate-100 bg-emerald-50/30">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {(["record_id", "sku", "medicine"] as const).map((field) => (
                  <input key={field} required value={inventoryForm[field]} onChange={(event) => setInventoryForm({ ...inventoryForm, [field]: event.target.value })} placeholder={field.replaceAll("_", " ")} className="lg:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" />
                ))}
                {(["closing_stock", "demand_7_days_avg", "lead_time_days", "reorder_point", "unit_cost_kes"] as const).map((field) => (
                  <input key={field} required type="number" min="0" value={inventoryForm[field] ?? 0} onChange={(event) => setInventoryForm({ ...inventoryForm, [field]: Number(event.target.value) })} placeholder={field.replaceAll("_", " ")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" />
                ))}
              </div>
              <button onClick={saveInventory} className="mt-4 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Save size={15} /> Save Record</button>
            </div>
          )}

          {inventoryLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading inventory...</p> : inventory.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No inventory records found.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">
                  <tr><th className="px-6 py-4">Record / SKU</th><th className="px-6 py-4">Medicine</th><th className="px-6 py-4">Closing Stock</th><th className="px-6 py-4">7-Day Demand</th><th className="px-6 py-4">Lead Time</th><th className="px-6 py-4">Reorder Point</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {inventory.map((item) => editingRecord === item.record_id ? (
                    <tr key={item.record_id} className="bg-emerald-50/40">
                      <td className="px-6 py-3"><div className="text-xs text-slate-500">{item.record_id}</div><input value={inventoryForm.sku} onChange={(event) => setInventoryForm({ ...inventoryForm, sku: event.target.value })} className="mt-1 w-28 rounded border border-slate-200 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><input value={inventoryForm.medicine} onChange={(event) => setInventoryForm({ ...inventoryForm, medicine: event.target.value })} className="w-36 rounded border border-slate-200 px-2 py-1 text-sm" /></td>
                      {(["closing_stock", "demand_7_days_avg", "lead_time_days", "reorder_point"] as const).map((field) => <td key={field} className="px-6 py-3"><input type="number" min="0" value={inventoryForm[field] ?? 0} onChange={(event) => setInventoryForm({ ...inventoryForm, [field]: Number(event.target.value) })} className="w-24 rounded border border-slate-200 px-2 py-1 text-sm" /></td>)}
                      <td className="px-6 py-3 text-right"><button onClick={saveInventory} aria-label="Save inventory record" className="mr-2 text-emerald-700"><Save size={17} /></button><button onClick={cancelInventoryEdit} aria-label="Cancel editing" className="text-slate-500"><X size={17} /></button></td>
                    </tr>
                  ) : (
                    <tr key={item.record_id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4"><div className="font-bold text-slate-900">{item.record_id}</div><div className="text-xs text-slate-500">{item.sku}</div></td><td className="px-6 py-4 font-semibold text-slate-800">{item.medicine}</td><td className="px-6 py-4">{item.closing_stock ?? 0}</td><td className="px-6 py-4">{item.demand_7_days_avg ?? 0}</td><td className="px-6 py-4">{item.lead_time_days ?? 0} days</td><td className="px-6 py-4">{item.reorder_point ?? 0}</td><td className="px-6 py-4 text-right"><button onClick={() => startInventoryEdit(item)} aria-label={`Edit ${item.medicine}`} className="mr-3 text-slate-500 hover:text-emerald-700"><Pencil size={17} /></button><button onClick={() => deleteInventory(item.record_id)} aria-label={`Delete ${item.medicine}`} className="text-slate-500 hover:text-rose-600"><Trash2 size={17} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>}

        {activeSection === "orders" && <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700"><ClipboardCheck size={18} strokeWidth={2.5} /></div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Purchase Orders</h2>
                <p className="text-sm text-slate-500 mt-1">Orders submitted for procurement review.</p>
              </div>
            </div>
          </div>
          {ordersLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading orders...</p> : orders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No purchase orders submitted yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">
                  <tr><th className="px-6 py-4">PO Reference</th><th className="px-6 py-4">Medicine / SKU</th><th className="px-6 py-4">Quantity</th><th className="px-6 py-4">Depletion</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Submitted</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-bold text-slate-900">{order.po_reference}</td>
                      <td className="px-6 py-4"><div className="font-semibold text-slate-800">{order.medicine}</div><div className="text-xs text-slate-500">{order.sku}</div></td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{order.quantity} units</td>
                      <td className="px-6 py-4 text-slate-700">{order.days_to_depletion} days</td>
                      <td className="px-6 py-4"><span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">{order.status}</span></td>
                      <td className="px-6 py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setEditingOrder({ ...order })} aria-label={`Edit ${order.po_reference}`} className="mr-3 text-slate-500 hover:text-emerald-700"><Pencil size={17} /></button>
                        <button onClick={() => deleteOrder(order)} aria-label={`Delete ${order.po_reference}`} className="text-slate-500 hover:text-rose-600"><Trash2 size={17} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>}
      </div>
 
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Purchase Order</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">Ref: {poReference} • Auto-Generated</p>
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
              <button onClick={submitOrder} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 active:scale-95">
                <ClipboardCheck size={16} /> Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <div><h2 className="text-xl font-extrabold text-slate-900">Edit Purchase Order</h2><p className="mt-1 text-xs font-medium text-slate-500">{editingOrder.po_reference}</p></div>
              <button onClick={() => setEditingOrder(null)} aria-label="Close edit order dialog" className="rounded-full bg-white p-2.5 text-slate-400 shadow-sm hover:bg-slate-200 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="space-y-5 p-6">
              <div><label htmlFor="edit-order-quantity" className="mb-2 block text-sm font-bold text-slate-700">Quantity (Units)</label><input id="edit-order-quantity" type="number" min="1" value={editingOrder.quantity} onChange={(event) => setEditingOrder({ ...editingOrder, quantity: Math.max(1, Number(event.target.value) || 1) })} className="w-full rounded-xl border border-slate-200 p-3 text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>
              <div><label htmlFor="edit-order-status" className="mb-2 block text-sm font-bold text-slate-700">Status</label><select id="edit-order-status" value={editingOrder.status} onChange={(event) => setEditingOrder({ ...editingOrder, status: event.target.value as Order["status"] })} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value="Review">Review</option><option value="Approved">Approved</option><option value="Received">Received</option><option value="Cancelled">Cancelled</option></select></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-6"><button onClick={() => setEditingOrder(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button><button onClick={updateOrder} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700"><Save size={16} /> Save Changes</button></div>
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

interface InventoryItem {
  record_id: string;
  sku: string;
  medicine: string;
  closing_stock: number | null;
  demand_7_days_avg: number | null;
  lead_time_days: number | null;
  reorder_point: number | null;
  unit_cost_kes: number | null;
}

interface Order {
  id: number;
  po_reference: string;
  sku: string;
  medicine: string;
  quantity: number;
  days_to_depletion: number;
  status: "Review" | "Approved" | "Received" | "Cancelled";
  created_at: string;
}

const inventoryFields = "record_id, sku, medicine, closing_stock, demand_7_days_avg, lead_time_days, reorder_point, unit_cost_kes";
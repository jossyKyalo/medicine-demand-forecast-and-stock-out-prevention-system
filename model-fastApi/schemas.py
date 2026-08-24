from pydantic import BaseModel

class ManualInferenceRequest(BaseModel):
    name: str
    sku: str
    currentStock: float
    dailyDemand: float
    leadTime: float
    
    # Dummy defaults for categorical data
    facility_type: str = "Pharmacy"
    facility_size: str = "Medium"
    facility_location_type: str = "Urban"
    medicine_category: str = "General"
    dosage_form: str = "Tablet"
    supplier_type: str = "KEMSA"
    supplier_reliability: str = "Medium"
    purchase_order_frequency: str = "Monthly"
    orders_cancelled: str = "No"
    reorder_flag: str = "No"
    demand_shock: str = "None"
    stockout_risk_category: str = "Low"
    expiry_risk: str = "Low"
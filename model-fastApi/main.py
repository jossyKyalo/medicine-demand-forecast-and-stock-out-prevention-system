from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
import joblib
import os
import xgboost as xgb
import sklearn

from schemas import ManualInferenceRequest 

app = FastAPI(
    title="Triage Dashboard API",
    description="Inference engine for medical supply chain stock-out prediction."
)

# Configure CORS to allow Next.js to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
preprocessor_clf = None
classifier_stockout = None

@app.on_event("startup")
def load_models():
    global preprocessor_clf, classifier_stockout
    
    # Dynamically build the path to the sibling 'models' directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "models")
    
    try:
        preprocessor_clf = joblib.load(os.path.join(models_dir, "preprocessor_clf.joblib"))
        classifier_stockout = joblib.load(os.path.join(models_dir, "classifier_stockout.joblib"))
        print("ML Pipelines loaded successfully!")
    except Exception as e:
        print(f"Warning: Could not load ML artifacts. Error: {e}")

@app.get("/")
async def root():
    return {
        "status": "online", 
        "message": "Medicine Stock-Out Inference API is running."
    }

# ==========================================
# 1. MANUAL INFERENCE ENDPOINT
# ==========================================
@app.post("/api/v1/predict/manual")
async def run_manual_inference(data: ManualInferenceRequest):
    if preprocessor_clf is None or classifier_stockout is None:
        raise HTTPException(status_code=503, detail="Machine Learning models are not loaded.")

    try:
        # Calculate operational metrics based on user input
        predicted_days = int(data.currentStock / data.dailyDemand) if data.dailyDemand > 0 else 999

        # Map the Next.js payload to the Pandas columns your model was trained on
        input_data = data.dict()
        input_data['closing_stock'] = input_data.pop('currentStock')
        input_data['lead_time_days'] = input_data.pop('leadTime')
        input_data['medicine'] = input_data.pop('name')
        input_data['expected_demand'] = input_data.pop('dailyDemand')
        sku = input_data.pop('sku')
        
       # Inject missing columns with NaN so the pipeline uses training medians
        missing_cols = [
            'safety_stock', 'day_of_week', 'purchase_order_quantity', 'order_delay_days', 
            'year', 'week_of_year', 'inventory_value_kes', 'inventory_turnover', 
            'registered_patients', 'demand_14_days_avg', 'forecast_next_30_days', 
            'demand_90_days_avg', 'adjusted_demand', 'month', 'previous_week_demand', 
            'expired_quantity', 'forecast_error_percentage', 'forecast_error', 
            'reorder_point', 'unit_cost_kes', 'quarter', 'forecast_next_14_days', 
            'prescriptions_issued', 'demand_7_days_avg', 'stock_adjustments', 
            'dispensed_quantity', 'opening_stock', 'forecast_next_7_days', 
            'outpatient_visits', 'demand_30_days_avg', 'previous_day_demand', 
            'stock_received', 'damaged_quantity', 'lost_demand_units',
            # --- The 12 Missing Columns ---
            'supplier_type', 'purchase_order_frequency', 'dosage_form', 
            'supplier_reliability', 'facility_location_type', 'reorder_flag', 
            'facility_type', 'medicine_category', 'orders_cancelled', 
            'facility_size', 'demand_shock', 'expiry_risk'
        ]
        
        for col in missing_cols:
            input_data[col] = float('nan')
            
        # Create DataFrame and run it through the preprocessor
        df_input = pd.DataFrame([input_data])
        
        # Transform and Predict Risk 
        X_processed = preprocessor_clf.transform(df_input)
        risk_prediction = classifier_stockout.predict(X_processed)[0]
        
        # Business Logic Routing
        if risk_prediction == 1:
            risk = "Critical" if predicted_days < df_input['lead_time_days'].iloc[0] else "Warning"
            reorder = True
        else:
            risk = "Safe"
            reorder = False

        # Return the exact JSON structure the Next.js Dashboard expects
        return {
            "sku": sku.upper(),
            "name": input_data['medicine'],
            "days_to_depletion": predicted_days,
            "stockout_risk": risk,
            "reorder_recommended": reorder
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 2. BATCH INFERENCE ENDPOINT
# ==========================================
# Define the expected structure for a single item in the batch
class BatchItem(BaseModel):
    sku: str
    name: str
    currentStock: float
    dailyDemand: float
    leadTime: float

# Define the expected structure for the whole request
class BatchPredictionRequest(BaseModel):
    items: List[BatchItem]

@app.post("/api/v1/predict/batch")
async def run_batch_inference(data: BatchPredictionRequest):
    if preprocessor_clf is None or classifier_stockout is None:
        raise HTTPException(status_code=503, detail="Machine Learning models are not loaded.")

    try:
        # Convert the incoming list of Pydantic models into a Pandas DataFrame
        items_dicts = [item.dict() for item in data.items]
        df = pd.DataFrame(items_dicts)

        # Calculate predicted days and save SKUs before we manipulate the DataFrame
        skus = df['sku'].tolist()
        predicted_days_list = []
        for _, row in df.iterrows():
            if row['dailyDemand'] > 0:
                predicted_days_list.append(int(row['currentStock'] / row['dailyDemand']))
            else:
                predicted_days_list.append(999)

        # Rename columns to match your ML pipeline's expected training features
        df = df.rename(columns={
            'currentStock': 'closing_stock',
            'leadTime': 'lead_time_days',
            'name': 'medicine',
            'dailyDemand': 'expected_demand'
        })
        
        df = df.drop(columns=['sku'])

        # Inject missing columns with NaN so the pipeline uses training medians
        missing_cols = [
            'safety_stock', 'day_of_week', 'purchase_order_quantity', 'order_delay_days', 
            'year', 'week_of_year', 'inventory_value_kes', 'inventory_turnover', 
            'registered_patients', 'demand_14_days_avg', 'forecast_next_30_days', 
            'demand_90_days_avg', 'adjusted_demand', 'month', 'previous_week_demand', 
            'expired_quantity', 'forecast_error_percentage', 'forecast_error', 
            'reorder_point', 'unit_cost_kes', 'quarter', 'forecast_next_14_days', 
            'prescriptions_issued', 'demand_7_days_avg', 'stock_adjustments', 
            'dispensed_quantity', 'opening_stock', 'forecast_next_7_days', 
            'outpatient_visits', 'demand_30_days_avg', 'previous_day_demand', 
            'stock_received', 'damaged_quantity', 'lost_demand_units',
            # --- The 12 Missing Columns ---
            'supplier_type', 'purchase_order_frequency', 'dosage_form', 
            'supplier_reliability', 'facility_location_type', 'reorder_flag', 
            'facility_type', 'medicine_category', 'orders_cancelled', 
            'facility_size', 'demand_shock', 'expiry_risk'
        ]
        for col in missing_cols:
            df[col] = float('nan')

        # Run the entire batch through the preprocessor and model at once!
        X_processed = preprocessor_clf.transform(df)
        risk_predictions = classifier_stockout.predict(X_processed)

        # Loop through the results to map our business logic back to each SKU
        results = []
        for i in range(len(skus)):
            pred = risk_predictions[i]
            p_days = predicted_days_list[i]
            lead_t = df['lead_time_days'].iloc[i]

            if pred == 1:
                risk = "Critical" if p_days < lead_t else "Warning"
                reorder = True
            else:
                risk = "Safe"
                reorder = False

            results.append({
                "sku": skus[i],
                "stockout_risk": risk,
                "reorder_recommended": reorder
            })

        return results

    except Exception as e:
        print(f"Batch Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
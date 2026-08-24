from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib
import os

# Import your schema from schemas.py
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
        print("✅ ML Pipelines loaded successfully!")
    except Exception as e:
        print(f"⚠️ Warning: Could not load ML artifacts. Error: {e}")
@app.get("/")
async def root():
    return {
        "status": "online", 
        "message": "Medicine Stock-Out Inference API is running."
    }
@app.post("/api/v1/predict/manual")
async def run_manual_inference(data: ManualInferenceRequest):
    if preprocessor_clf is None or classifier_stockout is None:
        raise HTTPException(status_code=503, detail="Machine Learning models are not loaded.")

    try:
        # 1. Calculate operational metrics based on user input
        predicted_days = int(data.currentStock / data.dailyDemand) if data.dailyDemand > 0 else 999

        # 2. Map the Next.js payload to the Pandas columns your model was trained on
        input_data = data.dict()
        input_data['closing_stock'] = input_data.pop('currentStock')
        input_data['lead_time_days'] = input_data.pop('leadTime')
        input_data['medicine'] = input_data.pop('name')
        
        # Remove fields that weren't part of the X_train feature set
        sku = input_data.pop('sku')
        input_data.pop('dailyDemand')
        
        # 3. Create DataFrame and run it through the preprocessor
        df_input = pd.DataFrame([input_data])
        
        # 4. Transform and Predict Risk (Returns 0 for Safe, 1 for Stock-out Risk)
        X_processed = preprocessor_clf.transform(df_input)
        risk_prediction = classifier_stockout.predict(X_processed)[0]
        
        # 5. Business Logic Routing
        if risk_prediction == 1:
            risk = "Critical" if predicted_days < df_input['lead_time_days'].iloc[0] else "Warning"
            reorder = True
        else:
            risk = "Safe"
            reorder = False

        # 6. Return the exact JSON structure the Next.js Dashboard expects
        return {
            "sku": sku.upper(),
            "name": data.name,
            "days_to_depletion": predicted_days,
            "stockout_risk": risk,
            "reorder_recommended": reorder
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
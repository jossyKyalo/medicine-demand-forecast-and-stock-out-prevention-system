from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
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
preprocessor_reg = None
regressor_demand = None
dataset = None


def prepare_features(frame, preprocessor):
    prepared = frame.copy()
    for column in prepared.select_dtypes(exclude=["number"]).columns:
        prepared[column] = prepared[column].astype(object).where(prepared[column].notna(), None)
    for column in preprocessor.transformers_[0][2]:
        if column not in prepared:
            prepared[column] = np.nan
        else:
            prepared[column] = pd.to_numeric(
                prepared[column].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            )
    for column in preprocessor.transformers_[1][2]:
        if column not in prepared:
            prepared[column] = "missing"
    return prepared.reindex(columns=preprocessor.feature_names_in_)


def score_dataset_rows(rows):
    clf_input = prepare_features(rows, preprocessor_clf)
    reg_input = prepare_features(rows, preprocessor_reg)
    risk_predictions = classifier_stockout.predict(preprocessor_clf.transform(clf_input))
    forecasts = regressor_demand.predict(preprocessor_reg.transform(reg_input))

    results = []
    for index, (_, row) in enumerate(rows.iterrows()):
        demand = pd.to_numeric(row.get("demand_7_days_avg", 0), errors="coerce")
        stock = pd.to_numeric(row.get("closing_stock", 0), errors="coerce")
        lead_time = pd.to_numeric(row.get("lead_time_days", 0), errors="coerce")
        demand = 0 if pd.isna(demand) else float(demand)
        stock = 0 if pd.isna(stock) else float(stock)
        lead_time = 0 if pd.isna(lead_time) else float(lead_time)
        days_to_depletion = int(stock / demand) if demand > 0 else 999
        risk_prediction = int(risk_predictions[index])
        risk = "Safe" if risk_prediction == 0 else ("Critical" if days_to_depletion < lead_time else "Warning")
        results.append({
            "sku": str(row.get("record_id", f"DATA-{index + 1}")),
            "name": str(row.get("medicine", "Unknown medicine")),
            "days_to_depletion": days_to_depletion,
            "stockout_risk": risk,
            "reorder_recommended": risk_prediction == 1,
            "forecast_next_7_days": round(float(forecasts[index]), 2),
        })
    return results

@app.on_event("startup")
def load_models():
    global preprocessor_clf, classifier_stockout, preprocessor_reg, regressor_demand, dataset
    
    # Dynamically build the path to the sibling 'models' directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "models")
    
    try:
        preprocessor_clf = joblib.load(os.path.join(models_dir, "preprocessor_clf.joblib"))
        classifier_stockout = joblib.load(os.path.join(models_dir, "classifier_stockout.joblib"))
        preprocessor_reg = joblib.load(os.path.join(models_dir, "preprocessor_reg.joblib"))
        regressor_demand = joblib.load(os.path.join(models_dir, "regressor_demand.joblib"))
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
    if any(model is None for model in (preprocessor_clf, classifier_stockout, preprocessor_reg, regressor_demand)):
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

        # Manual requests contain only operational inputs. Fill the remaining
        # training features so the persisted preprocessor sees the same schema.
        df_input = prepare_features(df_input, preprocessor_clf)
        
        # 4. Transform and Predict Risk (Returns 0 for Safe, 1 for Stock-out Risk)
        X_processed = preprocessor_clf.transform(df_input)
        risk_prediction = classifier_stockout.predict(X_processed)[0]

        regression_input = prepare_features(pd.DataFrame([input_data]), preprocessor_reg)
        regression_input['demand_7_days_avg'] = data.dailyDemand
        regression_input['previous_day_demand'] = data.dailyDemand
        regression_input['previous_week_demand'] = data.dailyDemand * 7
        regression_input = regression_input.reindex(columns=preprocessor_reg.feature_names_in_)
        forecast = float(regressor_demand.predict(preprocessor_reg.transform(regression_input))[0])
        
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
            "reorder_recommended": reorder,
            "forecast_next_7_days": round(forecast, 2)
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/predict/dataset")
async def predict_dataset(limit: int = Query(default=10, ge=1, le=50)):
    global dataset
    if any(model is None for model in (preprocessor_clf, classifier_stockout, preprocessor_reg, regressor_demand)):
        raise HTTPException(status_code=503, detail="Dataset or machine-learning models are not loaded.")

    try:
        if dataset is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            dataset_path = os.path.join(os.path.dirname(base_dir), "medical_demand_oversampled.xlsx")
            dataset = pd.read_excel(dataset_path)
            dataset.columns = (
                dataset.columns.str.strip().str.lower()
                .str.replace(" ", "_", regex=False)
                .str.replace("-", "_", regex=False)
            )
        return score_dataset_rows(dataset.head(limit).copy())
    except Exception as e:
        print(f"Dataset inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/predict/upload")
async def predict_uploaded_dataset(file: UploadFile = File(...)):
    if any(model is None for model in (preprocessor_clf, classifier_stockout, preprocessor_reg, regressor_demand)):
        raise HTTPException(status_code=503, detail="Machine-learning models are not loaded.")

    extension = os.path.splitext(file.filename or "")[1].lower()
    if extension not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Upload a CSV or Excel file.")

    try:
        content = await file.read()
        from io import BytesIO
        uploaded = BytesIO(content)
        rows = pd.read_csv(uploaded) if extension == ".csv" else pd.read_excel(uploaded)
        rows.columns = (
            rows.columns.astype(str).str.strip().str.lower()
            .str.replace(" ", "_", regex=False)
            .str.replace("-", "_", regex=False)
        )
        if rows.empty:
            raise HTTPException(status_code=400, detail="The uploaded dataset is empty.")
        rows = rows.head(1000).copy()

        def numeric_value(row, column):
            value = pd.to_numeric(row.get(column, 0), errors="coerce")
            return 0 if pd.isna(value) else float(value)

        inventory_records = []
        for index, (_, row) in enumerate(rows.iterrows()):
            record_id = str(row.get("record_id", row.get("sku", f"UPLOAD-{index + 1}")))
            inventory_records.append({
                "record_id": record_id,
                "sku": str(row.get("sku", record_id)),
                "medicine": str(row.get("medicine", row.get("name", "Unknown medicine"))),
                "closing_stock": numeric_value(row, "closing_stock"),
                "demand_7_days_avg": numeric_value(row, "demand_7_days_avg"),
                "lead_time_days": numeric_value(row, "lead_time_days"),
                "reorder_point": numeric_value(row, "reorder_point"),
                "unit_cost_kes": numeric_value(row, "unit_cost_kes"),
            })

        return {
            "filename": file.filename,
            "rows_processed": len(rows),
            "predictions": score_dataset_rows(rows),
            "inventory_records": inventory_records,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload inference error: {e}")
        raise HTTPException(status_code=400, detail=f"Could not process the uploaded dataset: {e}")
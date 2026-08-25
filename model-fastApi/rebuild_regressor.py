import os

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor


project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
workspace_dir = os.path.dirname(project_dir)
dataset_path = os.path.join(workspace_dir, "medical_demand_oversampled.xlsx")
models_dir = os.path.join(project_dir, "models")

df = pd.read_excel(dataset_path)
df.columns = (
    df.columns.str.strip().str.lower()
    .str.replace(" ", "_", regex=False)
    .str.replace("-", "_", regex=False)
)

target = "forecast_next_7_days"
leakage_cols = [
    "record_id", "date", "stock_out_flag", "stock_out_days",
    "stockout_risk_score", "stockout_risk_category",
    "forecast_next_14_days", "forecast_next_30_days",
    "forecast_error", "forecast_error_percentage", target,
]
df = df.dropna(subset=[target])
X = df.drop(columns=["stockout_within_30_days", *leakage_cols], errors="ignore")
y = pd.to_numeric(df[target], errors="coerce")

for column in X.select_dtypes(exclude=["number"]).columns:
    X[column] = X[column].astype(object).where(X[column].notna(), None)

preprocessor = joblib.load(os.path.join(models_dir, "preprocessor_reg.joblib"))
for column in preprocessor.transformers_[0][2]:
    X[column] = pd.to_numeric(X[column].astype(str).str.replace(",", "", regex=False), errors="coerce")
X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
X_train_processed = preprocessor.transform(X_train)

model = XGBRegressor(
    n_estimators=200,
    max_depth=8,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train_processed, y_train)
joblib.dump(model, os.path.join(models_dir, "regressor_demand.joblib"))
print("Regression artifact rebuilt successfully")
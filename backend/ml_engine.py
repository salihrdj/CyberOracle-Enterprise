import os
import joblib
import threading
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session
from database import GlobalThreat, IndiaCase

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# NextGen Model Constants & Logic
# ──────────────────────────────────────────────────────────────────────────────
ATTACK_TYPES = ['Ransomware', 'DDoS', 'Phishing', 'SQL Injection', 'Malware']
INDUSTRIES = ['Healthcare', 'Finance', 'Energy', 'Government', 'Education']
REGIONS = ['North America', 'Europe', 'Asia-Pacific', 'Latin America', 'Middle East']

def preprocess_and_encode(df):
    processed_df = df.copy()
    
    # One-hot encoding categories
    for category in ATTACK_TYPES:
        processed_df[f'attack_type_{category}'] = (processed_df['attack_type'] == category).astype(int)
        
    for category in INDUSTRIES:
        processed_df[f'industry_{category}'] = (processed_df['industry'] == category).astype(int)
        
    for category in REGIONS:
        processed_df[f'region_{category}'] = (processed_df['region'] == category).astype(int)
        
    feature_cols = ['severity']
    feature_cols += [f'attack_type_{c}' for c in ATTACK_TYPES]
    feature_cols += [f'industry_{c}' for c in INDUSTRIES]
    feature_cols += [f'region_{c}' for c in REGIONS]
    
    X = processed_df[feature_cols]
    return X, feature_cols

def train_nextgen_models(csv_path: str):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"NextGen dataset not found at {csv_path}")
        
    df = pd.read_csv(csv_path)
    X, feature_cols = preprocess_and_encode(df)
    
    y_threat = df['threat_score']
    y_growth = df['growth_probability']
    
    X_train, X_test, y_threat_train, y_threat_test, y_growth_train, y_growth_test = train_test_split(
        X, y_threat, y_growth, test_size=0.2, random_state=42
    )
    
    rf_threat = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_threat.fit(X_train, y_threat_train)
    
    rf_growth = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_growth.fit(X_train, y_growth_train)
    
    joblib.dump(rf_threat, os.path.join(MODEL_DIR, 'rf_threat_model.joblib'))
    joblib.dump(rf_growth, os.path.join(MODEL_DIR, 'rf_growth_model.joblib'))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, 'feature_cols.joblib'))
    print("NextGen ML models trained successfully.")

# Cache NextGen regressor models globally in memory
cached_rf_threat = None
cached_rf_growth = None
cached_feature_cols = None

model_lock = threading.Lock()

def predict_single(attack_type, industry, region, severity):
    global cached_rf_threat, cached_rf_growth, cached_feature_cols
    
    rf_threat_path = os.path.join(MODEL_DIR, 'rf_threat_model.joblib')
    rf_growth_path = os.path.join(MODEL_DIR, 'rf_growth_model.joblib')
    feature_cols_path = os.path.join(MODEL_DIR, 'feature_cols.joblib')
    
    with model_lock:
        if not (os.path.exists(rf_threat_path) and os.path.exists(rf_growth_path)):
            # Train on default CSV path
            csv_path = os.path.join(BASE_DIR, 'data', 'cybersecurity_attacks.csv')
            train_nextgen_models(csv_path)
            
        if cached_rf_threat is None:
            cached_rf_threat = joblib.load(rf_threat_path)
        if cached_rf_growth is None:
            cached_rf_growth = joblib.load(rf_growth_path)
        if cached_feature_cols is None:
            cached_feature_cols = joblib.load(feature_cols_path)
        
    rf_threat = cached_rf_threat
    rf_growth = cached_rf_growth
    feature_cols = cached_feature_cols
    
    input_data = {
        'severity': [severity],
        'attack_type': [attack_type],
        'industry': [industry],
        'region': [region]
    }
    df_input = pd.DataFrame(input_data)
    X_input, _ = preprocess_and_encode(df_input)
    
    threat_score = float(rf_threat.predict(X_input)[0])
    growth_prob = float(rf_growth.predict(X_input)[0])
    
    # Calculate explainable AI contributions
    importances = rf_threat.feature_importances_
    contributions = {}
    total_active_importance = 0
    raw_contribs = {}
    
    for feature, val in zip(feature_cols, X_input.iloc[0]):
        if val > 0:
            feat_idx = feature_cols.index(feature)
            feat_importance = importances[feat_idx]
            
            if feature == 'severity':
                weight = feat_importance * (severity / 10.0)
            else:
                weight = feat_importance
                
            raw_contribs[feature] = weight
            total_active_importance += weight
            
    if total_active_importance > 0:
        for feature, weight in raw_contribs.items():
            contrib_pct = (weight / total_active_importance) * 100
            display_name = feature
            if feature.startswith('attack_type_'):
                display_name = f"Attack Type ({feature.replace('attack_type_', '')})"
            elif feature.startswith('industry_'):
                display_name = f"Industry ({feature.replace('industry_', '')})"
            elif feature.startswith('region_'):
                display_name = f"Region ({feature.replace('region_', '')})"
            elif feature == 'severity':
                display_name = f"Severity (Level {severity})"
                
            contributions[display_name] = round(contrib_pct, 1)
            
    return {
        "threat_score": round(threat_score, 2),
        "growth_probability": round(growth_prob, 4),
        "explainability": contributions
    }

# ──────────────────────────────────────────────────────────────────────────────
# CyberOracle Trend Forecasting Models
# ──────────────────────────────────────────────────────────────────────────────
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTH_ENCODING_MAP = {m: i for i, m in enumerate(MONTHS)}

# Maintain label encoders globally
le_country = LabelEncoder()
le_attack = LabelEncoder()
le_industry = LabelEncoder()
le_month = LabelEncoder()

# Models are cached in memory for the running session
oracle_classifier = None
oracle_regressor = None
attack_trend_df = None
forecast_df_cache = None

def train_cyberoracle_models(db: Session):
    global oracle_classifier, oracle_regressor, attack_trend_df, forecast_df_cache
    
    global_threats = db.query(GlobalThreat).all()
    india_cases = db.query(IndiaCase).all()
    
    if not global_threats:
        print("No global threats in database to train CyberOracle models.")
        return
        
    # Convert to DataFrames
    global_df = pd.DataFrame([{
        "year": g.year, "country": g.country or "Global",
        "attack_type": g.attack_type or "Unknown", "target_industry": g.target_industry or "Unknown",
        "financial_loss_in_million_": g.financial_loss_in_million_ or 0.0,
        "number_of_affected_users": g.number_of_affected_users or 0
    } for g in global_threats])
    
    india_df = pd.DataFrame([{
        "year": i.year, "incident_type": i.incident_type or "Unknown"
    } for i in india_cases])
    
    india_yearly = india_df.groupby("year").size().reset_index(name="attack_count")
    global_yearly = global_df.groupby("year").size().reset_index(name="attack_count")
    india_yearly["source"] = "India"
    global_yearly["source"] = "Global"
    combined_df = pd.concat([india_yearly, global_yearly])
    
    # Pre-process classifier data
    np.random.seed(42)
    forecast_df = global_df.copy()
    
    # Distribute months with historical weights
    month_weights = {"Jan": 3.2, "Feb": 1.8, "Mar": 1.5, "Apr": 1.2, "May": 1.1, "Jun": 1.0, 
                     "Jul": 0.9, "Aug": 0.9, "Sep": 1.0, "Oct": 2.0, "Nov": 2.5, "Dec": 2.8}
    weights = np.array([month_weights[m] for m in MONTHS])
    weights = weights / weights.sum()
    forecast_df["month"] = np.random.choice(MONTHS, size=len(forecast_df), p=weights)
    
    # Financial loss adjustments
    high_risk_months = ["Jan", "Oct", "Nov", "Dec"]
    forecast_df.loc[forecast_df["month"].isin(high_risk_months), "financial_loss_in_million_"] *= 1.10
    
    forecast_df["country_encoded"] = le_country.fit_transform(forecast_df["country"])
    forecast_df["attack_encoded"] = le_attack.fit_transform(forecast_df["attack_type"])
    forecast_df["industry_encoded"] = le_industry.fit_transform(forecast_df["target_industry"])
    forecast_df["month_encoded"] = le_month.fit_transform(forecast_df["month"])
    
    def classify_risk(loss):
        if loss < 20: return 0
        elif loss < 50: return 1
        return 2
        
    forecast_df["risk_level"] = forecast_df["financial_loss_in_million_"].apply(classify_risk)
    
    oracle_classifier = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    X_class = forecast_df[["year", "country_encoded", "attack_encoded", "industry_encoded", "month_encoded"]]
    y_class = forecast_df["risk_level"]
    oracle_classifier.fit(X_class, y_class)
    
    # Pre-process regressor data
    attack_trend_df = combined_df.copy()
    attack_trend_df["source_encoded"] = attack_trend_df["source"].map({"India": 0, "Global": 1})
    attack_trend_df = attack_trend_df.sort_values(["source", "year"])
    attack_trend_df["previous_attacks"] = attack_trend_df.groupby("source")["attack_count"].shift(1)
    attack_trend_df = attack_trend_df.dropna()
    attack_trend_df["month"] = np.random.choice(MONTHS, size=len(attack_trend_df), p=weights)
    attack_trend_df["month_encoded"] = attack_trend_df["month"].map(MONTH_ENCODING_MAP)
    
    oracle_regressor = RandomForestRegressor(n_estimators=100, random_state=42)
    X_reg = attack_trend_df[["year", "source_encoded", "previous_attacks", "month_encoded"]]
    y_reg = attack_trend_df["attack_count"]
    oracle_regressor.fit(X_reg, y_reg)
    
    forecast_df_cache = forecast_df
    print("CyberOracle Trend forecasting models trained successfully in memory.")

def predict_cyberoracle_forecast(region: str, year: int, month: str, db: Session):
    global oracle_classifier, oracle_regressor, attack_trend_df, forecast_df_cache
    if oracle_classifier is None or oracle_regressor is None:
        train_cyberoracle_models(db)
        
    if oracle_classifier is None or oracle_regressor is None:
        return {"error": "Insufficient threat data in database to perform predictions."}
        
    source_encoded = 1 if region == "Global" else 0
    month_encoded_input = MONTH_ENCODING_MAP[month]
    
    historical_source = attack_trend_df[attack_trend_df["source_encoded"] == source_encoded]
    base_attacks = historical_source["attack_count"].mean() if not historical_source.empty else 100.0

    growth_factor = 1 + ((year - 2025) * 0.12)
    month_boost = 1.20 if month in ["Jan", "Oct", "Nov", "Dec"] else (0.92 if month in ["Jun", "Jul", "Aug"] else 1.0)
    last_attacks = base_attacks * growth_factor * month_boost

    attack_input = pd.DataFrame([[year, source_encoded, last_attacks, month_encoded_input]], 
                                columns=["year", "source_encoded", "previous_attacks", "month_encoded"])
    predicted_attacks = float(oracle_regressor.predict(attack_input)[0])

    future_gap = year - 2025
    if region == "Global":
        top_attack = "Phishing" if future_gap <= 1 else ("Ransomware" if future_gap <= 3 else "AI-Powered Cyber Attacks")
        top_sector = "Finance" if future_gap <= 1 else ("Healthcare" if future_gap <= 3 else "Critical Infrastructure")
        top_region = "USA" if future_gap <= 1 else ("Germany" if future_gap <= 3 else "UK")
    else:
        top_attack = "UPI Fraud" if future_gap <= 1 else ("Ransomware" if future_gap <= 3 else "Deepfake Financial Fraud")
        top_sector = "Banking" if future_gap <= 1 else ("IT" if future_gap <= 3 else "Government")
        top_region = "Mumbai" if future_gap <= 1 else ("Bengaluru" if future_gap <= 3 else "Delhi")

    random_country = np.random.choice(forecast_df_cache["country"].unique())
    random_attack = np.random.choice(forecast_df_cache["attack_type"].unique())
    random_industry = np.random.choice(forecast_df_cache["target_industry"].unique())

    future_data = pd.DataFrame([[
        year, 
        le_country.transform([random_country])[0], 
        le_attack.transform([random_attack])[0], 
        le_industry.transform([random_industry])[0], 
        month_encoded_input
    ]], columns=["year", "country_encoded", "attack_encoded", "industry_encoded", "month_encoded"])
    
    predicted_risk = int(oracle_classifier.predict(future_data)[0])
    risk_map = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
    threat_score = min(100, int(predicted_attacks / 5))

    return {
        "predictedAttacks": int(predicted_attacks),
        "financialRisk": risk_map[predicted_risk],
        "threatScore": threat_score,
        "insights": {
            "topSector": top_sector,
            "topAttack": top_attack,
            "topRegion": top_region,
            "highRiskMonth": month
        }
    }

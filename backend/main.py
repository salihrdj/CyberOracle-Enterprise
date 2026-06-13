import os
import asyncio
import random
import secrets
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends, Security, Header, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from jose import jwt, JWTError
import bcrypt
import argon2
from argon2 import PasswordHasher
from sqlalchemy import text, func
from sqlalchemy.orm import Session
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Database imports
from database import (
    get_db, init_db, SessionLocal, Client, Scan, ScanHost, OpenPort,
    SiemAlert, IndiaCase, GlobalThreat, NetworkAttack, OtxIntel, CveTable,
    MaliciousDomain, MaliciousIp, IndiaStateThreat, ThreatActor, User, AuditLog
)

# Utility modules
from ml_engine import predict_single, predict_cyberoracle_forecast, train_cyberoracle_models
from ai_analyst import analyze_threat, analyze_threat_stream
from system_scanner import full_system_scan, get_local_ip
from pro_scanner import full_engagement_scan
from report_generator import generate_report
from scheduler import start_scheduler
import tempfile

# ── Environment & Authentication Configuration ────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required. Generate with: openssl rand -hex 32")

# JWT Key Rotation: Support multiple keys (current + previous)
# Format: JSON dict with key_id -> secret_key mapping
# Example: '{"key-1": "secret1", "key-2": "secret2"}'
# Current key is the first one; previous keys are kept for token validation during rotation
JWT_KEYS_JSON = os.getenv("JWT_KEYS", "")
if JWT_KEYS_JSON:
    import json
    try:
        JWT_KEYS = json.loads(JWT_KEYS_JSON)
        if not isinstance(JWT_KEYS, dict) or not JWT_KEYS:
            raise ValueError("JWT_KEYS must be a non-empty dict")
    except Exception as e:
        raise RuntimeError(f"Invalid JWT_KEYS format: {e}")
else:
    # Fallback to single SECRET_KEY for backward compatibility
    JWT_KEYS = {"default": SECRET_KEY}

# Current key ID (first key in dict for backward compat, or explicit env var)
CURRENT_KEY_ID = os.getenv("JWT_CURRENT_KEY_ID", next(iter(JWT_KEYS)))

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15 minutes (reduced from 24 hours)
REFRESH_TOKEN_EXPIRE_DAYS = 7
JWT_AUDIENCE = "cyberoracle-api"
JWT_ISSUER = "cyberoracle-auth"

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
auth_header = APIKeyHeader(name="Authorization", auto_error=False)

# Argon2id hasher (preferred algorithm)
_argon2_hasher = PasswordHasher(
    time_cost=3,        # Iterations
    memory_cost=65536,  # 64 MB
    parallelism=4,      # Threads
    hash_len=32,
    salt_len=16,
    type=argon2.Type.ID
)

def verify_password(plain_password, hashed_password):
    """
    Verify password against hash.
    Supports both Argon2id (preferred) and bcrypt (legacy).
    """
    # Try Argon2id first (preferred)
    if hashed_password.startswith("$argon2"):
        try:
            _argon2_hasher.verify(hashed_password, plain_password)
            return True
        except argon2.exceptions.VerifyMismatchError:
            return False
        except Exception:
            return False

    # Fallback to bcrypt for legacy hashes
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password):
    """
    Hash password using Argon2id (preferred algorithm).
    Returns Argon2id hash string.
    """
    return _argon2_hasher.hash(password)


def get_password_hash_bcrypt(password):
    """
    Legacy bcrypt hashing (for compatibility).
    Use get_password_hash() for new passwords.
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=14)).decode('utf-8')


def needs_rehash(hashed_password):
    """
    Check if password hash should be upgraded to Argon2id.
    Returns True for bcrypt hashes or old Argon2id parameters.
    """
    if hashed_password.startswith("$argon2"):
        # Could check parameters here if needed
        return False
    # bcrypt hashes start with $2b$ or $2a$ or $2y$
    return hashed_password.startswith(("$2b$", "$2a$", "$2y$"))

def _get_current_secret() -> str:
    """Get the current signing secret."""
    return JWT_KEYS.get(CURRENT_KEY_ID, SECRET_KEY)


def _get_all_secrets() -> List[str]:
    """Get all secrets for validation (current + previous)."""
    return list(JWT_KEYS.values())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, key_id: Optional[str] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "kid": key_id or CURRENT_KEY_ID  # Key ID for rotation
    })
    secret = JWT_KEYS.get(key_id or CURRENT_KEY_ID, _get_current_secret())
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=ALGORITHM, headers={"kid": key_id or CURRENT_KEY_ID})
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None, key_id: Optional[str] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "kid": key_id or CURRENT_KEY_ID
    })
    secret = JWT_KEYS.get(key_id or CURRENT_KEY_ID, _get_current_secret())
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=ALGORITHM, headers={"kid": key_id or CURRENT_KEY_ID})
    return encoded_jwt

# Verify access token or static API Key (supports key rotation)
def get_current_user(
    x_api_key: Optional[str] = Depends(api_key_header),
    authorization: Optional[str] = Depends(auth_header),
    db: Session = Depends(get_db)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif x_api_key:
        token = x_api_key

    if not token:
        raise HTTPException(status_code=401, detail="Authentication credentials missing.")

    # Try all available keys for key rotation support
    last_error = None
    for secret in _get_all_secrets():
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[ALGORITHM],
                audience=JWT_AUDIENCE,
                issuer=JWT_ISSUER
            )
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(status_code=401, detail="Invalid token payload.")
            # Ensure it's an access token, not refresh token
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token type.")
            # Token validated successfully
            break
        except JWTError as e:
            last_error = e
            continue
    else:
        # All keys failed
        raise HTTPException(status_code=401, detail=f"Invalid or expired authentication token: {str(last_error)}")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

# ── App Initialization ────────────────────────────────────────────────────────
app = FastAPI(
    title="CyberOracle Enterprise Suite API",
    description="Unified API combining threat forecasting, SIEM live simulations, WebSockets, active scans, and n8n orchestration.",
    version="2.0.0"
)

# CORS
cors_origins = os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
allow_creds = True
if "*" in cors_origins:
    allow_creds = False

# Restrict allowed methods and headers for security
allowed_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
allowed_headers = [
    "Authorization",
    "Content-Type",
    "Accept",
    "Origin",
    "X-Requested-With",
    "X-API-Key",
    "Sec-WebSocket-Protocol",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_creds,
    allow_methods=allowed_methods,
    allow_headers=allowed_headers,
    expose_headers=["Content-Disposition"],
    max_age=600,  # Cache preflight for 10 minutes
)

# Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    # HTTP Strict Transport Security (HSTS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Permissions Policy
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )

    # Remove server header
    response.headers.pop("Server", None)

    return response

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Audit Logging Middleware
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    start_time = datetime.utcnow()
    response = await call_next(request)
    
    # Log sensitive operations
    sensitive_paths = ["/api/auth/login", "/api/scans", "/api/clients", "/api/scan", "/api/check-ip"]
    should_log = any(request.url.path.startswith(p) for p in sensitive_paths) or request.method in ["POST", "PUT", "DELETE", "PATCH"]
    
    if should_log:
        db = SessionLocal()
        try:
            # Try to get user from auth header
            username = None
            user_id = None
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    username = payload.get("sub")
                    if username:
                        user = db.query(User).filter(User.username == username).first()
                        if user:
                            user_id = user.id
                except JWTError:
                    pass
            
            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]
            
            audit = AuditLog(
                user_id=user_id,
                username=username,
                action=f"{request.method} {request.url.path}",
                resource=request.url.path.split("/")[2] if len(request.url.path.split("/")) > 2 else None,
                ip_address=client_ip,
                user_agent=user_agent,
                details={"query_params": dict(request.query_params)},
                status="success" if response.status_code < 400 else "failure"
            )
            db.add(audit)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    
    return response

# ── Real-Time WebSocket Manager ────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket Client connected. Active sessions: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"WebSocket Client disconnected. Active sessions: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        bad_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                bad_connections.append(connection)
        for connection in bad_connections:
            try:
                self.disconnect(connection)
            except ValueError:
                pass

ws_manager = ConnectionManager()

# ── Ingest Simulation Background Thread ───────────────────────────────────────
live_threats: List[Dict[str, Any]] = []
simulation_active = True

async def simulate_soc_alerts_loop():
    global live_threats, simulation_active
    print("Background SOC Alert simulation loop started.")
    
    attack_types = ['Ransomware', 'DDoS', 'Phishing', 'SQL Injection', 'Malware']
    industries = ['Healthcare', 'Finance', 'Energy', 'Government', 'Education']
    regions = ['North America', 'Europe', 'Asia-Pacific', 'Latin America', 'Middle East']
    
    while simulation_active:
        await asyncio.sleep(5)  # Threat alert every 5 seconds
        
        severity = random.randint(1, 10)
        attack = random.choice(attack_types)
        industry = random.choice(industries)
        region = random.choice(regions)
        
        # Calculate ML scores
        try:
            pred_data = predict_single(attack, industry, region, severity)
            threat_score = pred_data["threat_score"]
            growth_prob = pred_data["growth_probability"]
            explainability = pred_data["explainability"]
        except Exception:
            threat_score = severity * 10.0
            growth_prob = severity * 0.10
            explainability = {}
            
        risk_level = "LOW"
        if threat_score >= 75: risk_level = "CRITICAL"
        elif threat_score >= 50: risk_level = "HIGH"
        elif threat_score >= 25: risk_level = "MEDIUM"
        
        # Enrichment payloads
        from main import SplunkSimulator, VirusTotalSimulator
        splunk_data = SplunkSimulator.query_logs(attack, region)
        vt_data = VirusTotalSimulator.scan_indicators(attack)
        
        event = {
            "id": f"EV-{secrets.token_hex(4).upper()}",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "attack_type": attack,
            "industry": industry,
            "region": region,
            "severity": severity,
            "threat_score": threat_score,
            "growth_probability": round(growth_prob * 100, 1),
            "risk_level": risk_level,
            "explainability": explainability,
            "enrichment": {
                "splunk": splunk_data,
                "virustotal": vt_data
            }
        }
        
        live_threats.insert(0, event)
        if len(live_threats) > 50:
            live_threats.pop()
            
        # Write to PostgreSQL DB
        db_session = SessionLocal()
        try:
            db_alert = SiemAlert(
                event_id=event["id"],
                timestamp=datetime.strptime(event["timestamp"], '%Y-%m-%d %H:%M:%S'),
                attack_type=attack,
                industry=industry,
                region=region,
                severity=severity,
                threat_score=threat_score,
                growth_probability=growth_prob,
                risk_level=risk_level,
                explainability=explainability,
                splunk_logs=splunk_data,
                vt_reputation=vt_data
            )
            db_session.add(db_alert)
            db_session.commit()
            
            # Direct critical email trigger
            if risk_level == "CRITICAL":
                send_critical_email_alert(event)
        except Exception as e:
            db_session.rollback()
            print(f"Error persisting simulated alert to DB: {e}")
        finally:
            db_session.close()
            
        # Broadcast via WebSockets
        await ws_manager.broadcast({"type": "NEW_ALERT", "data": event})

@app.on_event("startup")
def startup_event():
    # Database initialize
    try:
        init_db()
        db = SessionLocal()
        
        # Seed admin user from environment variable if configured
        from database import User
        import bcrypt
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin_password = os.getenv("INIT_ADMIN_PASSWORD")
            if admin_password:
                print("Seeding admin user from INIT_ADMIN_PASSWORD...")
                hashed = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                admin_user = User(username="admin", password_hash=hashed, role="administrator")
                db.add(admin_user)
                db.commit()
                print("Admin user seeded successfully from environment.")
            else:
                print("No admin user exists. Set INIT_ADMIN_PASSWORD to create initial admin, or use the setup script.")
            
        # Train ML models in database
        train_cyberoracle_models(db)
        db.close()
    except Exception as e:
        print(f"PostgreSQL connection offline or failed: {e}. Running in standalone mode.")
        
    # Start background CVE threat feed scheduler
    try:
        start_scheduler()
    except Exception as se:
        print(f"Failed to start threat feed scheduler: {se}")

    # Start live SOC simulation loop
    loop = asyncio.get_event_loop()
    loop.create_task(simulate_soc_alerts_loop())

@app.on_event("shutdown")
def shutdown_event():
    global simulation_active
    simulation_active = False

# ── SMTP Critical Email Alert Dispatcher ──────────────────────────────────────
def send_critical_email_alert(alert_data: dict):
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    recipient = os.getenv("ALERT_RECIPIENT_EMAIL")
    
    if not (smtp_server and smtp_port and smtp_user and smtp_password and recipient):
        print("SMTP settings incomplete. Skipping direct email alert dispatch.")
        return False
        
    try:
        smtp_port = int(smtp_port)
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = recipient
        # Sanitize header values to prevent email header injection
        attack_type = alert_data.get('attack_type', 'Unknown').replace('\n', '').replace('\r', '')[:100]
        region = alert_data.get('region', 'Unknown').replace('\n', '').replace('\r', '')[:100]
        msg['Subject'] = f"🚨 [CRITICAL SOC ALERT] - {attack_type} Detected in {region}"
        
        # HTML Email Body
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #04050e; color: #e2e8f0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #0c0f24; border: 1px solid #fb7185; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(251, 113, 133, 0.15);">
                <h2 style="color: #fb7185; border-bottom: 2px solid #fb7185; padding-bottom: 10px; margin-top: 0; text-transform: uppercase; letter-spacing: 2px;">
                    Critical Security Incident Detected
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; color: #cbd5e1;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 180px;">Event ID:</td>
                        <td style="padding: 8px 0; font-family: monospace; color: #38bdf8;">{alert_data.get('id', alert_data.get('event_id', 'N/A'))}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Attack Type:</td>
                        <td style="padding: 8px 0; font-weight: bold; color: #ffffff;">{alert_data.get('attack_type')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Target Sector:</td>
                        <td style="padding: 8px 0;">{alert_data.get('industry')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Target Region:</td>
                        <td style="padding: 8px 0;">{alert_data.get('region')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">ML Threat Score:</td>
                        <td style="padding: 8px 0; font-weight: bold; color: #fb7185;">{alert_data.get('threat_score')}/100</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Growth Probability:</td>
                        <td style="padding: 8px 0; color: #fbbf24;">{alert_data.get('growth_probability')}%</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Timestamp:</td>
                        <td style="padding: 8px 0;">{alert_data.get('timestamp')}</td>
                    </tr>
                </table>
                <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 15px; margin-top: 20px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #38bdf8; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Recommended Remediation Playbook:</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                        <li>Isolate target endpoints in the {alert_data.get('industry')} subnet immediately.</li>
                        <li>Verify firewalls are blocking ingress traffic from flagged Splunk IP indicators.</li>
                        <li>Dispatch incident responders to execute backup verification protocols.</li>
                    </ol>
                </div>
                <p style="font-size: 10px; color: #64748b; text-align: center; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 15px; font-family: monospace;">
                    CYBERORACLE ENTERPRISE SOC ALERTS · ENCRYPTED COMMUNICATION
                </p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, 'html'))
        
        # Connect and Send
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipient, msg.as_string())
        server.quit()
        print(f"Direct critical email alert successfully dispatched to {recipient}")
        return True
    except Exception as e:
        print(f"Failed to send direct email alert: {e}")
        return False

# ── Splunk & VirusTotal Simulators ────────────────────────────────────────────
class SplunkSimulator:
    @staticmethod
    def query_logs(attack_type: str, region: str) -> Dict[str, Any]:
        return {
            "status": "success",
            "source": "Splunk Enterprise Indexer",
            "query_time_ms": random.randint(120, 450),
            "total_correlated_events": random.randint(5, 45),
            "matching_rules": ["SUSPICIOUS_INGRESS_DETECTED", "BRUTE_FORCE_SIGNATURE_MATCH"],
            "raw_payloads": [
                f"{{'ip': '185.220.101.{random.randint(1,254)}', 'action': 'blocked', 'signature': '{attack_type} pattern detected in {region}'}}"
            ]
        }

class VirusTotalSimulator:
    @staticmethod
    def scan_indicators(attack_type: str) -> Dict[str, Any]:
        malicious_votes = random.randint(15, 68) if attack_type in ['Ransomware', 'Malware'] else random.randint(0, 5)
        return {
            "status": "success",
            "indicator_scanned": f"artifact_hash_{random.randint(100000, 999999)}",
            "harmless_votes": 75 - malicious_votes,
            "malicious_votes": malicious_votes,
            "suspicious_votes": random.randint(0, 10),
            "reputation_rating": "MALICIOUS" if malicious_votes > 10 else "CLEAN",
            "engine_analysis": {
                "Kaspersky": "malicious" if malicious_votes > 10 else "clean",
                "CrowdStrike": "suspicious" if malicious_votes > 15 else "clean",
                "Symantec": "malicious" if malicious_votes > 10 else "clean"
            }
        }

# ── WebSocket Alert Stream Route ──────────────────────────────────────────────
async def verify_ws_token(websocket: WebSocket) -> Optional[str]:
    """Extract and verify JWT token from WebSocket headers (Authorization or Sec-WebSocket-Protocol)."""
    token = None

    # Check Authorization header (preferred)
    if "authorization" in websocket.headers:
        auth_header = websocket.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    # Check Sec-WebSocket-Protocol header (for browser WebSocket clients)
    elif "sec-websocket-protocol" in websocket.headers:
        protocol = websocket.headers["sec-websocket-protocol"]
        if protocol.startswith("auth."):
            token = protocol[5:]  # Remove "auth." prefix

    # REMOVED: Query parameter token (security risk - leaks in URLs/logs)
    # REMOVED: X-API-Key header (confusion with API keys)

    if not token:
        return None

    # Try all available keys for key rotation support
    for secret in _get_all_secrets():
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[ALGORITHM],
                audience=JWT_AUDIENCE,
                issuer=JWT_ISSUER
            )
            username: str = payload.get("sub")
            if username is None:
                return None
            # Ensure it's an access token
            if payload.get("type") != "access":
                return None
            return username
        except JWTError:
            continue

    return None

@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    username = await verify_ws_token(websocket)
    if not username:
        await websocket.close(code=4001, reason="Authentication required")
        return
    
    await ws_manager.connect(websocket)
    try:
        # Keep connection open and send initial history cache
        await websocket.send_json({"type": "INITIAL_CACHE", "data": live_threats})
        while True:
            # Keep socket alive and receive client inputs if any
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# ── API Routes: Authentication ────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials. Access Denied.")

    # Upgrade legacy bcrypt hashes to Argon2id on successful login
    if needs_rehash(user.password_hash):
        user.password_hash = get_password_hash(req.password)
        db.commit()

    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {
        "authenticated": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"name": user.username, "role": user.role}
    }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@app.post("/api/auth/refresh")
@limiter.limit("10/minute")
def refresh_token(request: Request, req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Exchange refresh token for new access token."""
    try:
        payload = jwt.decode(
            req.refresh_token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type.")
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    # Create new access token (and optionally rotate refresh token)
    new_access_token = create_access_token(data={"sub": user.username})
    new_refresh_token = create_refresh_token(data={"sub": user.username})  # Rotate refresh token

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

# ── API Routes: CyberOracle Core Dashboard ────────────────────────────────────
@app.get("/api/overview")
def get_overview(source: str = "All", db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        # Fetch India yearly counts using ORM (parameterized)
        india_counts = db.query(IndiaCase.year, func.count(IndiaCase.id).label("attack_count")).group_by(IndiaCase.year).all()
        # Fetch Global yearly counts using ORM (parameterized)
        global_counts = db.query(GlobalThreat.year, func.count(GlobalThreat.id).label("attack_count")).group_by(GlobalThreat.year).all()

        india_yearly = {row.year: row.attack_count for row in india_counts}
        global_yearly = {row.year: row.attack_count for row in global_counts}
    except Exception as e:
        print(f"Error reading from DB for overview trends: {e}")
        # DB fallback
        return {
            "metrics": {"totalIncidents": 150, "financialLoss": 45.2, "lossDelta": 2.5, "affectedUsers": 45000, "usersDelta": 1.2},
            "trends": [{"year": 2024, "attack_count": 50}, {"year": 2025, "attack_count": 100}],
            "impact": [{"year": 2024, "financial_loss_in_million_": 20.0}, {"year": 2025, "financial_loss_in_million_": 25.2}]
        }

    # Combined trends depending on source
    all_years = sorted(list(set(list(india_yearly.keys()) + list(global_yearly.keys()))))
    trends_list = []
    for yr in all_years:
        ind_val = india_yearly.get(yr, 0)
        glob_val = global_yearly.get(yr, 0)
        if source == "All":
            trends_list.append({"year": yr, "attack_count": ind_val + glob_val})
        elif source == "India":
            trends_list.append({"year": yr, "attack_count": ind_val})
        else: # Global
            trends_list.append({"year": yr, "attack_count": glob_val})

    # Now calculate agg_metrics for loss and affected users
    try:
        if source == "India":
            # Group by year for India cases using ORM with case expression
            from sqlalchemy import case, func
            incident_case = case(
                (func.lower(IndiaCase.incident_type) == 'data_breach', 1200),
                (func.lower(IndiaCase.incident_type) == 'phishing', 15),
                (func.lower(IndiaCase.incident_type) == 'ransomware', 500),
                (func.lower(IndiaCase.incident_type) == 'malware', 200),
                else_=100
            )
            metrics_rows = db.query(
                IndiaCase.year,
                func.coalesce(func.sum(IndiaCase.amount_lost_inr / 83000000.0), 0.0).label("financial_loss_in_million_"),
                func.coalesce(func.sum(incident_case), 0).label("number_of_affected_users")
            ).group_by(IndiaCase.year).all()
        else:
            # For Global or All, use global_threats metrics aggregation using ORM
            metrics_rows = db.query(
                GlobalThreat.year,
                func.coalesce(func.sum(GlobalThreat.financial_loss_in_million_), 0.0).label("financial_loss_in_million_"),
                func.coalesce(func.sum(GlobalThreat.number_of_affected_users), 0).label("number_of_affected_users")
            ).group_by(GlobalThreat.year).all()

        agg_metrics = [{"year": row.year, "financial_loss_in_million_": row.financial_loss_in_million_, "number_of_affected_users": row.number_of_affected_users} for row in metrics_rows]
    except Exception as e:
        print(f"Error reading metrics from DB: {e}")
        agg_metrics = []

    # Process metrics
    latest_year = max([row["year"] for row in agg_metrics]) if agg_metrics else 0
    latest_data = [row for row in agg_metrics if row["year"] == latest_year]
    prev_data = [row for row in agg_metrics if row["year"] == latest_year - 1]
    
    loss_val = sum(row["financial_loss_in_million_"] for row in latest_data)
    users_val = sum(row["number_of_affected_users"] for row in latest_data)
    
    prev_loss = sum(row["financial_loss_in_million_"] for row in prev_data)
    prev_users = sum(row["number_of_affected_users"] for row in prev_data)
    
    loss_delta = ((loss_val - prev_loss) / prev_loss) * 100 if prev_loss else 0
    users_delta = ((users_val - prev_users) / prev_users) * 100 if prev_users else 0
    
    # Total incidents for the latest year
    total_incidents = 0
    for trend in trends_list:
        if trend["year"] == latest_year:
            total_incidents = trend["attack_count"]
            break

    impact_data = [{"year": row["year"], "financial_loss_in_million_": row["financial_loss_in_million_"]} for row in agg_metrics]

    return {
        "metrics": {
            "totalIncidents": int(total_incidents),
            "financialLoss": round(float(loss_val), 2),
            "lossDelta": float(loss_delta),
            "affectedUsers": int(users_val),
            "usersDelta": float(users_delta),
        },
        "trends": trends_list,
        "impact": impact_data
    }

@app.get("/api/network")
def get_network(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        protocols = db.query(
            NetworkAttack.protocol.label("name"),
            func.count(NetworkAttack.id).label("value")
        ).group_by(NetworkAttack.protocol).all()

        severities = db.query(
            NetworkAttack.severity_level.label("name"),
            func.count(NetworkAttack.id).label("value")
        ).group_by(NetworkAttack.severity_level).all()

        locations = db.query(
            NetworkAttack.latitude,
            NetworkAttack.longitude
        ).filter(
            NetworkAttack.latitude.isnot(None),
            NetworkAttack.longitude.isnot(None)
        ).limit(100).all()

        protocol_dist = [{"name": row.name, "value": row.value} for row in protocols]
        severity_dist = [{"name": row.name, "value": row.value} for row in severities]
        locations_list = [{"latitude": row.latitude, "longitude": row.longitude} for row in locations]
    except Exception as e:
        print(f"Error reading network attacks: {e}")
        protocol_dist = [{"name": "TCP", "value": 45}, {"name": "UDP", "value": 30}, {"name": "ICMP", "value": 10}]
        severity_dist = [{"name": "High", "value": 20}, {"name": "Medium", "value": 45}, {"name": "Low", "value": 80}]
        locations_list = []

    return {
        "protocols": protocol_dist,
        "severities": severity_dist,
        "locations": locations_list
    }

@app.get("/api/india")
def get_india_hub(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        state_rows = db.query(
            IndiaStateThreat.state,
            IndiaStateThreat.detections
        ).order_by(IndiaStateThreat.detections.desc()).all()

        state_dist = [{"state": row.state, "detections": row.detections} for row in state_rows]
        top_state = state_dist[0]["state"] if state_dist else "Unknown"
    except Exception as e:
        print(f"Error reading india state threats: {e}")
        top_state = "Maharashtra"
        state_dist = [{"state": "Maharashtra", "detections": 150000}, {"state": "Delhi", "detections": 85000}]

    ransomware = [
        {"Month": "Jan", "Detections": 113000}, {"Month": "Feb", "Detections": 74000},
        {"Month": "Mar", "Detections": 71000}, {"Month": "Apr", "Detections": 69000},
        {"Month": "May", "Detections": 57000}, {"Month": "Jun", "Detections": 56000},
        {"Month": "Jul", "Detections": 55000}, {"Month": "Aug", "Detections": 61000},
        {"Month": "Sep", "Detections": 64000}
    ]
    return {
        "topState": top_state,
        "states": state_dist,
        "ransomware": ransomware
    }


@app.get("/api/tables")
def get_tables(db: Session = Depends(get_db)):
    actors = db.query(ThreatActor).limit(50).all()
    cves = db.query(CveTable).limit(50).all()
    return {
        "actors": [{"group": a.group, "type": a.type, "risk_level": a.risk_level, "attacks": a.attacks} for a in actors],
        "cves": [{"cve": c.cve, "severity": c.severity, "affected_sector": c.affected_sector} for c in cves]
    }

# ── API Routes: Quick Threat Scanner ──────────────────────────────────────────
@app.get("/api/check-ip")
@limiter.limit("30/minute")
def check_ip(request: Request, ip: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ip = ip.strip()
    try:
        from scan_validator import validate_scan_target, check_scan_authorization
        ips, _ = validate_scan_target(ip)
        authorized, unauthorized = check_scan_authorization(ips)
        if not authorized:
            return {"error": True, "message": "Target not authorized for scanning."}
        ip = authorized[0]
    except Exception as e:
        return {"error": True, "message": str(e)}
    
    try:
        import ipaddress
        ipaddress.ip_address(ip)
        
        # Check Local Blacklist domain/IP database
        local_found = db.query(MaliciousIp).filter(MaliciousIp.ip == ip).first() is not None
        otx_found = db.query(OtxIntel).filter(OtxIntel.indicator == ip).first() is not None
        
        return {"ip": ip, "localBlacklist": local_found, "otxThreat": otx_found, "error": False}
    except ValueError:
        return {"error": True, "message": "Invalid IP format."}

scan_semaphore = threading.Semaphore(2)

def run_background_scan(target: str, scan_id: int):
    # Control concurrency using the semaphore
    scan_semaphore.acquire(blocking=True)
    bg_db = SessionLocal()
    try:
        full_engagement_scan(target, scan_id, bg_db)
    finally:
        bg_db.close()
        scan_semaphore.release()

@app.get("/api/scan")
@limiter.limit("10/minute")
def active_scan(request: Request, ip: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ip = ip.strip()
    try:
        from scan_validator import validate_scan_target, check_scan_authorization
        ips, _ = validate_scan_target(ip)
        authorized, unauthorized = check_scan_authorization(ips)
        if not authorized:
            return {"error": True, "message": "Target not authorized for scanning."}
        ip = authorized[0]
    except Exception as e:
        return {"error": True, "message": str(e)}

    try:
        from scanner import scan_target
        results = scan_target(ip)
        return {"ip": ip, "open_ports": results, "error": False}
    except ValueError as e:
        return {"error": True, "message": str(e)}

# ── API Routes: Client & Engagement Scan Management ──────────────────────────
class ClientCreate(BaseModel):
    name: str
    description: str = ""

@app.get("/api/clients")
def list_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
    return [{
        "id": c.id, "name": c.name, "description": c.description,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "scan_count": len(c.scans)
    } for c in clients]

@app.post("/api/clients")
def create_client(req: ClientCreate, db: Session = Depends(get_db)):
    client = Client(name=req.name, description=req.description)
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"id": client.id, "name": client.name}

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return {"ok": True}

class ScanCreate(BaseModel):
    client_id: int
    target: str

@app.get("/api/scans")
def list_scans(client_id: int = None, db: Session = Depends(get_db)):
    q = db.query(Scan)
    if client_id:
        q = q.filter(Scan.client_id == client_id)
    scans = q.order_by(Scan.started_at.desc()).all()
    return [{
        "id": s.id, "client_id": s.client_id, "target": s.target,
        "status": s.status,
        "host_count": len(s.hosts),
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "finished_at": s.finished_at.isoformat() if s.finished_at else None,
    } for s in scans]

@app.post("/api/scans")
@limiter.limit("5/minute")
def start_scan(request: Request, req: ScanCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == req.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    scan = Scan(client_id=req.client_id, target=req.target, status="pending")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    scan_id = scan.id

    background_tasks.add_task(run_background_scan, req.target, scan_id)

    return {"scan_id": scan_id, "status": "pending", "message": "Scan queued in background."}

@app.get("/api/scans/{scan_id}")
def get_scan(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    if scan.status == "complete" and not scan.ai_summary:
        open_port_count = sum(len(h.ports) for h in scan.hosts)
        critical = sum(1 for h in scan.hosts for p in h.ports if p.severity == "Critical")
        high     = sum(1 for h in scan.hosts for p in h.ports if p.severity == "High")
        services = ', '.join(set(p.service for h in scan.hosts for p in h.ports)) or 'none'
        cves     = list(set(p.cve for h in scan.hosts for p in h.ports if p.cve))[:6]

        context = (
            f"Target: {scan.target} | Hosts: {len(scan.hosts)} | "
            f"Open Ports: {open_port_count} | Critical CVEs: {critical} | High CVEs: {high} | "
            f"Services Detected: {services} | Notable CVEs: {', '.join(cves) or 'none'}"
        )
        
        prompt = f"""You are writing a professional security assessment report section.
Generate a structured executive risk summary in **Markdown format** with the following sections:

## Risk Overview
One paragraph assessing the overall risk level (Critical / High / Medium / Low) with justification.

## Key Findings
A bullet list of the most important security findings (open dangerous ports, critical CVEs, exposed services).

## Recommended Actions
A numbered list of prioritized remediation steps the client should take immediately.

## Risk Score
End with a single line: **Risk Score: X/10** — where X is your assessment (10 = most critical).

Use professional, technical language. Be specific and actionable. Scan data: {context}"""

        summary = analyze_threat(prompt, context)
        scan.ai_summary = summary
        db.commit()

    return {
        "id": scan.id, "target": scan.target, "status": scan.status,
        "ai_summary": scan.ai_summary,
        "started_at": scan.started_at.isoformat() if scan.started_at else None,
        "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
        "hosts": [{
            "id": h.id, "ip": h.ip, "hostname": h.hostname, "os_guess": h.os_guess,
            "ports": [{
                "port": p.port, "service": p.service, "banner": p.banner,
                "cve": p.cve, "severity": p.severity, "description": p.description
            } for p in h.ports]
        } for h in scan.hosts]
    }

@app.get("/api/scans/{scan_id}/report")
def download_report(scan_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.status != "complete":
        raise HTTPException(status_code=400, detail="Scan is not complete yet.")

    client = db.query(Client).filter(Client.id == scan.client_id).first()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", prefix=f"cyberoracle_scan_{scan_id}_")
    tmp.close()
    generate_report(scan, client, tmp.name)

    def cleanup_temp_file(filepath: str):
        try:
            os.unlink(filepath)
        except Exception:
            pass

    background_tasks.add_task(cleanup_temp_file, tmp.name)

    # Sanitize client name for filename (prevent path traversal)
    import re
    safe_client_name = re.sub(r'[^a-zA-Z0-9_-]', '_', client.name) if client else "Unknown"
    safe_client_name = safe_client_name[:50]  # Limit length
    filename = f"CyberOracle_Report_{safe_client_name}_{scan_id}.pdf"
    return FileResponse(
        tmp.name, media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── API Routes: Local Security Health Posture ─────────────────────────────────
@app.get("/api/local-ip")
def get_local_network_ip(current_user = Depends(get_current_user)):
    return {"ip": get_local_ip()}

@app.post("/api/system-scan")
def run_system_scan(current_user = Depends(get_current_user)):
    report = full_system_scan()
    context = (
        f"Firewall Status: {report['firewall']['status']} (Secure: {report['firewall']['secure']}). "
        f"Windows Defender: {report['defender']['status']} (Secure: {report['defender']['secure']}). "
        f"Active Connections: {report['network']['established_connections']}. "
    )

    prompt = f"""You are analyzing a local Windows machine's security posture.
Generate a short Markdown summary with two sections:
## Posture Assessment
Briefly state if the system is secure or at risk based on the firewall and defender status.
## Recommendations
Provide 2-3 bullet points for securing the system if any components are disabled.
Context: {context}"""

    report["ai_summary"] = analyze_threat(prompt, context)
    return report

# ── API Routes: AI Chat Analyst ───────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    context: str = ""

@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, current_user = Depends(get_current_user)):
    return StreamingResponse(analyze_threat_stream(req.query, req.context), media_type="text/event-stream")

# ── API Routes: Machine Learning Predictions ──────────────────────────────────
class ForecastRequest(BaseModel):
    region: str
    year: int
    month: str

@app.post("/api/forecast")
@limiter.limit("10/minute")
def get_forecast(request: Request, req: ForecastRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return predict_cyberoracle_forecast(req.region, req.year, req.month, db)

# ── NextGen SOC Stream Endpoints ──────────────────────────────────────────────
class ThreatInput(BaseModel):
    attack_type: str
    industry: str
    region: str
    severity: int

class ThreatAnalysisRequest(BaseModel):
    attack_type: str
    industry: str
    region: str
    severity: int
    threat_score: float
    growth_probability: float
    explainability: Dict[str, float]

@app.get("/api/threats/live")
def get_live_threats(current_user = Depends(get_current_user)):
    return live_threats

@app.get("/api/threats/history")
def get_threat_history(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    alerts = db.query(SiemAlert).order_by(SiemAlert.timestamp.desc()).limit(100).all()
    return [{
        "attack_type": a.attack_type, "industry": a.industry, "region": a.region,
        "severity": a.severity, "threat_score": a.threat_score, "growth_probability": a.growth_probability,
        "timestamp": a.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    } for a in alerts]

@app.post("/api/threats/predict")
@limiter.limit("20/minute")
def predict_threat(request: Request, payload: ThreatInput, current_user = Depends(get_current_user)):
    try:
        prediction = predict_single(
            attack_type=payload.attack_type,
            industry=payload.industry,
            region=payload.region,
            severity=payload.severity
        )
        threat_score = prediction["threat_score"]
        growth_prob = prediction["growth_probability"]
        
        risk_level = "LOW"
        if threat_score >= 75: risk_level = "CRITICAL"
        elif threat_score >= 50: risk_level = "HIGH"
        elif threat_score >= 25: risk_level = "MEDIUM"
            
        actions = []
        if risk_level in ["CRITICAL", "HIGH"]:
            actions = [
                f"Isolate infected endpoints in the {payload.industry} environment.",
                "Verify and initiate offline backup restoration protocols.",
                "Trigger SOC high-severity playbook and page responders.",
                "Block source network IPs identified in Splunk logs at firewall perimeter."
            ]
        elif risk_level == "MEDIUM":
            actions = [
                f"Flag {payload.attack_type} indicators for standard monitoring.",
                "Increase logging verbosity on network interfaces.",
                "Correlate local credentials logs for authentication anomalies."
            ]
        else:
            actions = [
                "Log threat metadata in database.",
                "Mark alert as Low Risk; no immediate action required."
            ]
            
        return {
            "input": payload.dict(),
            "predicted_threat_score": threat_score,
            "predicted_growth_probability": round(growth_prob * 100, 1),
            "predicted_risk_level": risk_level,
            "explainability": prediction["explainability"],
            "recommended_actions": actions,
            "enrichments": {
                "splunk": SplunkSimulator.query_logs(payload.attack_type, payload.region),
                "virustotal": VirusTotalSimulator.scan_indicators(payload.attack_type)
            }
        }
    except Exception as e:
        print(f"ML Prediction Engine error: {e}")
        raise HTTPException(status_code=500, detail="ML Prediction Engine failed. Please contact your administrator.")

@app.post("/api/threats/analyze")
@limiter.limit("10/minute")
def analyze_threat_incident(request: Request, payload: ThreatAnalysisRequest, current_user = Depends(get_current_user)):
    system_date = datetime.now().strftime('%Y-%m-%d')
    context = (
        f"Attack: {payload.attack_type} | Sector: {payload.industry} | "
        f"Score: {payload.threat_score} | Region: {payload.region} | Growth: {payload.growth_probability}%"
    )
    prompt = f"""Write an AI security incident report dossier for:
- Attack Type: {payload.attack_type}
- Industry: {payload.industry}
- Region: {payload.region}
- Threat Score: {payload.threat_score}/100
- lateral Growth Probability: {payload.growth_probability}%
Explain the attack vector, machine learning features context, and outline a recommended response playbook."""
    
    report_text = analyze_threat(prompt, context)
    
    return {
        "status": "success",
        "model": "cyberoracle-enterprise-analyst",
        "prompt_template_used": "cyber_threat_report_generation_v2",
        "ai_analysis_report": report_text
    }

@app.post("/api/threats/trigger-n8n")
async def trigger_n8n_workflow(payload: Dict[str, Any]):
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/threat-alert")
    print(f"Triggering n8n webhook with payload: {payload}")
    n8n_success = False
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=2.0)
            if response.status_code == 200:
                n8n_success = True
                return {
                    "status": "success",
                    "n8n_status": "active",
                    "message": "Webhook triggered successfully. Incident routing executed.",
                    "n8n_response": response.json()
                }
    except Exception:
        pass
        
    # Fallback to direct SMTP dispatch if n8n is offline and threat is high/critical
    email_dispatched = False
    if not n8n_success and payload.get("predicted_risk_level") in ["CRITICAL", "HIGH"]:
        alert_dict = {
            "id": payload.get("input", {}).get("id", "EV-SOAR-" + secrets.token_hex(4).upper()),
            "attack_type": payload.get("input", {}).get("attack_type"),
            "industry": payload.get("input", {}).get("industry"),
            "region": payload.get("input", {}).get("region"),
            "threat_score": payload.get("predicted_threat_score"),
            "growth_probability": payload.get("predicted_growth_probability"),
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        email_dispatched = send_critical_email_alert(alert_dict)

    recipient = os.getenv("ALERT_RECIPIENT_EMAIL", "soc-leads@company.com")
    return {
        "status": "success",
        "n8n_status": "simulated",
        "message": f"Simulated execution. n8n workflow would route {payload.get('predicted_risk_level', 'UNKNOWN')} alert. Direct email dispatch: {'SUCCESS' if email_dispatched else 'SKIPPED/FAILED'}",
        "routing_simulation": {
            "slack_channel": "#soc-alerts-critical" if payload.get("predicted_threat_score", 0) >= 50 else "#soc-alerts-low",
            "email_dispatched_to": recipient,
            "workflow_execution_id": f"n8n-wf-{secrets.token_hex(6)}"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

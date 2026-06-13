import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cyber_enterprise")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Authenticaton & Operator Schema ──────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="operator")
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Client & Active Scan Schema ───────────────────────────────────────────────
class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    scans = relationship("Scan", back_populates="client", cascade="all, delete-orphan")

class Scan(Base):
    __tablename__ = "scans"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    target = Column(String(255), nullable=False)
    status = Column(String(50), default="pending")  # pending, running, complete, failed
    ai_summary = Column(Text, default="")
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="scans")
    hosts = relationship("ScanHost", back_populates="scan", cascade="all, delete-orphan")

class ScanHost(Base):
    __tablename__ = "scan_hosts"
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False)
    ip = Column(String(50), nullable=False)
    hostname = Column(String(255), default="")
    os_guess = Column(String(100), default="Unknown")

    scan = relationship("Scan", back_populates="hosts")
    ports = relationship("OpenPort", back_populates="host", cascade="all, delete-orphan")

class OpenPort(Base):
    __tablename__ = "open_ports"
    id = Column(Integer, primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("scan_hosts.id", ondelete="CASCADE"), nullable=False)
    port = Column(Integer, nullable=False)
    service = Column(String(50), default="Unknown")
    banner = Column(Text, default="")
    cve = Column(String(50), default="")
    severity = Column(String(50), default="")
    description = Column(Text, default="")

    host = relationship("ScanHost", back_populates="ports")

# ── NextGen SOC Ingestion Schema ──────────────────────────────────────────────
class SiemAlert(Base):
    __tablename__ = "siem_alerts"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    attack_type = Column(String(100), nullable=False)
    industry = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)
    severity = Column(Integer, nullable=False)
    threat_score = Column(Float, nullable=False)
    growth_probability = Column(Float, nullable=False)
    risk_level = Column(String(50), nullable=False)
    explainability = Column(JSON, default=dict)
    splunk_logs = Column(JSON, default=dict)
    vt_reputation = Column(JSON, default=dict)

# ── Threat Intelligence & Historical Tables ──────────────────────────────────
class IndiaCase(Base):
    __tablename__ = "india_cases"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    incident_type = Column(String(100))
    amount_lost_inr = Column(Float)

class GlobalThreat(Base):
    __tablename__ = "global_threats"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    country = Column(String(100))
    attack_type = Column(String(100))
    target_industry = Column(String(100))
    financial_loss_in_million_ = Column(Float)
    number_of_affected_users = Column(Integer)

class NetworkAttack(Base):
    __tablename__ = "network_attacks"
    id = Column(Integer, primary_key=True, index=True)
    protocol = Column(String(50))
    severity_level = Column(String(50))
    latitude = Column(Float)
    longitude = Column(Float)

class OtxIntel(Base):
    __tablename__ = "otx_intel"
    id = Column(Integer, primary_key=True, index=True)
    indicator = Column(String(255))
    threat_type = Column(String(100))
    description = Column(Text)

class CveTable(Base):
    __tablename__ = "cves"
    id = Column(Integer, primary_key=True, index=True)
    cve = Column(String(50))
    severity = Column(String(50))
    affected_sector = Column(String(255))

class MaliciousDomain(Base):
    __tablename__ = "malicious_domains"
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255))

class MaliciousIp(Base):
    __tablename__ = "malicious_ips"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(50))

class IndiaStateThreat(Base):
    __tablename__ = "india_state_threats"
    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(100))
    detections = Column(Integer)

class ThreatActor(Base):
    __tablename__ = "threat_actors"
    id = Column(Integer, primary_key=True, index=True)
    group = Column(String(100))
    type = Column(String(100))
    risk_level = Column(String(50))
    attacks = Column(Text)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(JSON, default=dict)
    status = Column(String(20), default="success")

def init_db():
    Base.metadata.create_all(bind=engine)

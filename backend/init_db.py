import sqlite3
import os
from sqlalchemy.orm import Session
from database import (
    engine, Base, init_db, SessionLocal,
    IndiaCase, GlobalThreat, NetworkAttack, OtxIntel, CveTable,
    MaliciousDomain, MaliciousIp, IndiaStateThreat, ThreatActor, User
)
import argon2
from argon2 import PasswordHasher

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.getenv("SQLITE_PATH", os.path.join(BASE_DIR, "..", "..", "Cybersecurity AI Analysis", "backend", "cyber_intel.db"))

# Argon2id hasher (same parameters as main.py)
_argon2_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=argon2.Type.ID
)

def hash_password(password: str) -> str:
    return _argon2_hasher.hash(password)

def migrate_table(sqlite_conn, pg_session, table_name, model_class, field_mapping):
    cursor = sqlite_conn.cursor()
    try:
        # Check if table exists in SQLite
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        if not cursor.fetchone():
            print(f"Table {table_name} does not exist in SQLite. Skipping.")
            return

        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        col_names = [description[0] for description in cursor.description]
        
        # Check if we already have records in PostgreSQL
        if pg_session.query(model_class).count() > 0:
            print(f"PostgreSQL table for {model_class.__tablename__} already contains data. Skipping migration.")
            return

        print(f"Migrating {len(rows)} rows from SQLite table '{table_name}' to PostgreSQL...")
        
        pg_objects = []
        for row in rows:
            row_dict = dict(zip(col_names, row))
            # Construct model attributes
            kwargs = {}
            for pg_field, sq_field in field_mapping.items():
                val = row_dict.get(sq_field)
                kwargs[pg_field] = val
            pg_objects.append(model_class(**kwargs))
            
            # Batch inserts to avoid overloading
            if len(pg_objects) >= 500:
                pg_session.bulk_save_objects(pg_objects)
                pg_session.commit()
                pg_objects = []
                
        if pg_objects:
            pg_session.bulk_save_objects(pg_objects)
            pg_session.commit()
        print(f"Successfully migrated table '{table_name}'.")
    except Exception as e:
        pg_session.rollback()
        print(f"Error migrating table '{table_name}': {e}")

def main():
    print("Initializing PostgreSQL tables...")
    init_db()
    print("PostgreSQL tables initialized.")

    pg_session = SessionLocal()

    # Create admin user if it does not exist
    admin = pg_session.query(User).filter(User.username == "admin").first()
    if not admin:
        admin_password = os.getenv("INIT_ADMIN_PASSWORD")
        if admin_password:
            print("Creating admin user from INIT_ADMIN_PASSWORD...")
            hashed = hash_password(admin_password)
            admin_user = User(username="admin", password_hash=hashed, role="administrator")
            pg_session.add(admin_user)
            pg_session.commit()
            print("Admin user created successfully from environment.")
        else:
            print("No admin user exists. Set INIT_ADMIN_PASSWORD environment variable to create initial admin.")
    else:
        print("Admin user already exists.")

    # Migrate intelligence data from SQLite
    if os.path.exists(SQLITE_PATH):
        print(f"Connecting to SQLite database at {SQLITE_PATH}...")
        sqlite_conn = sqlite3.connect(SQLITE_PATH)
        
        # Mapping dicts: { pg_field: sq_field }
        migrate_table(
            sqlite_conn, pg_session, "india_cases", IndiaCase,
            {"year": "year", "incident_type": "incident_type", "amount_lost_inr": "amount_lost_inr"}
        )
        migrate_table(
            sqlite_conn, pg_session, "global_threats", GlobalThreat,
            {
                "year": "year", "country": "country", "attack_type": "attack_type",
                "target_industry": "target_industry", "financial_loss_in_million_": "financial_loss_in_million_",
                "number_of_affected_users": "number_of_affected_users"
            }
        )
        migrate_table(
            sqlite_conn, pg_session, "network_attacks", NetworkAttack,
            {"protocol": "protocol", "severity_level": "severity_level", "latitude": "latitude", "longitude": "longitude"}
        )
        migrate_table(
            sqlite_conn, pg_session, "otx_intel", OtxIntel,
            {"indicator": "indicator", "threat_type": "threat_type", "description": "description"}
        )
        migrate_table(
            sqlite_conn, pg_session, "cves", CveTable,
            {"cve": "cve", "severity": "severity", "affected_sector": "affected_sector"}
        )
        migrate_table(
            sqlite_conn, pg_session, "malicious_domains", MaliciousDomain,
            {"domain": "domain"}
        )
        migrate_table(
            sqlite_conn, pg_session, "malicious_ips", MaliciousIp,
            {"ip": "ip"}
        )
        migrate_table(
            sqlite_conn, pg_session, "india_state_threats", IndiaStateThreat,
            {"state": "state", "detections": "detections"}
        )
        migrate_table(
            sqlite_conn, pg_session, "threat_actors", ThreatActor,
            {"group": "group", "type": "type", "risk_level": "risk_level", "attacks": "attacks"}
        )
        
        sqlite_conn.close()
        print("SQLite migration finished.")
    else:
        print(f"SQLite database not found at '{SQLITE_PATH}'. Skipping intelligence data migration.")

    pg_session.close()
    print("Database initialization complete.")

if __name__ == "__main__":
    main()

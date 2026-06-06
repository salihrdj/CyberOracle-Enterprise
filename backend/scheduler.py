import os
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from database import SessionLocal, CveTable

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

def fetch_latest_cves():
    """Fetch the latest CVEs from NVD API and update the database."""
    print("Fetching latest CVEs from NVD API...")
    try:
        # Fetch 20 most recent CVEs
        response = requests.get(f"{NVD_API_URL}?resultsPerPage=20", timeout=10)
        if response.status_code == 200:
            data = response.json()
            cve_items = data.get("vulnerabilities", [])
            
            new_cves = []
            for item in cve_items:
                cve = item.get("cve", {})
                cve_id = cve.get("id")
                
                # Extract severity (V3 or V2)
                metrics = cve.get("metrics", {})
                severity = "Medium" # Default
                if "cvssMetricV31" in metrics:
                    severity = metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseSeverity", "Medium")
                elif "cvssMetricV30" in metrics:
                    severity = metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseSeverity", "Medium")
                elif "cvssMetricV2" in metrics:
                    severity = metrics["cvssMetricV2"][0].get("baseSeverity", "Medium")
                    
                # Description
                descriptions = cve.get("descriptions", [])
                desc = descriptions[0]["value"] if descriptions else "No description"
                
                new_cves.append({
                    "cve": cve_id,
                    "severity": severity.capitalize(),
                    "affected_sector": desc[:250] # Allow longer summary
                })
                
            if new_cves:
                db: Session = SessionLocal()
                try:
                    cve_ids = [item["cve"] for item in new_cves]
                    # Check which CVEs already exist in database
                    existing_cves = db.query(CveTable.cve).filter(CveTable.cve.in_(cve_ids)).all()
                    existing_ids = {r[0] for r in existing_cves}
                    
                    to_insert = []
                    for item in new_cves:
                        if item["cve"] not in existing_ids:
                            to_insert.append(CveTable(
                                cve=item["cve"],
                                severity=item["severity"],
                                affected_sector=item["affected_sector"]
                            ))
                    
                    if to_insert:
                        print(f"Adding {len(to_insert)} new CVEs to the database.")
                        db.bulk_save_objects(to_insert)
                        db.commit()
                    else:
                        print("No new CVEs found to insert.")
                except Exception as db_err:
                    db.rollback()
                    print(f"Database error during CVE insertion: {db_err}")
                finally:
                    db.close()
        else:
            print(f"Failed to fetch from NVD: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error fetching live CVEs: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run the fetch_latest_cves job every 12 hours
    scheduler.add_job(fetch_latest_cves, 'interval', hours=12)
    # Also trigger once on startup
    scheduler.add_job(fetch_latest_cves)
    scheduler.start()
    print("Background Scheduler Started: Live NVD CVE Threat Feed Active.")

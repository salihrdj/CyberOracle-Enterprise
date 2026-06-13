import os
import requests
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from database import SessionLocal, CveTable

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
OSV_API_URL = "https://api.osv.dev/v1/vulns"

# Cache for OSV lookups to avoid repeated API calls
_osv_cache = {}
_osv_cache_ttl = timedelta(hours=24)

def fetch_nvd_cves(start_index=0, results_per_page=50):
    """Fetch CVEs from NVD API with pagination support."""
    print(f"Fetching CVEs from NVD API (start={start_index}, limit={results_per_page})...")
    try:
        # Use pubStartDate to get recent CVEs (last 30 days)
        pub_start = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000")
        params = {
            "startIndex": start_index,
            "resultsPerPage": results_per_page,
            "pubStartDate": pub_start,
        }
        response = requests.get(NVD_API_URL, params=params, timeout=30)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"NVD API error: HTTP {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"Error fetching from NVD: {e}")
        return None


def fetch_osv_vuln(cve_id):
    """Fetch detailed vulnerability info from OSV for a specific CVE."""
    # Check cache first
    if cve_id in _osv_cache:
        cached_time, cached_data = _osv_cache[cve_id]
        if datetime.utcnow() - cached_time < _osv_cache_ttl:
            return cached_data

    try:
        response = requests.get(f"{OSV_API_URL}/{cve_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            _osv_cache[cve_id] = (datetime.utcnow(), data)
            return data
    except Exception as e:
        print(f"Error fetching {cve_id} from OSV: {e}")
    return None


def extract_cve_details(nvd_cve, osv_data=None):
    """Extract standardized CVE details from NVD and OSV data."""
    cve = nvd_cve.get("cve", {})
    cve_id = cve.get("id")

    # Extract severity (prefer CVSS v3.1)
    metrics = cve.get("metrics", {})
    severity = "Medium"
    cvss_score = 5.0
    cvss_vector = ""

    for metric_version in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
        if metric_version in metrics and metrics[metric_version]:
            metric = metrics[metric_version][0]
            cvss_data = metric.get("cvssData", {})
            severity = cvss_data.get("baseSeverity", "Medium")
            cvss_score = cvss_data.get("baseScore", 5.0)
            cvss_vector = cvss_data.get("vectorString", "")
            break

    # Description
    descriptions = cve.get("descriptions", [])
    desc = descriptions[0]["value"] if descriptions else "No description"

    # References
    references = []
    for ref in cve.get("references", [])[:10]:
        references.append(ref.get("url", ""))

    # CWE IDs
    cwe_ids = []
    for weakness in cve.get("weaknesses", []):
        for desc in weakness.get("description", []):
            cwe_ids.append(desc.get("value", ""))

    # Enrich with OSV data (affected packages, versions)
    affected_packages = []
    if osv_data:
        for affected in osv_data.get("affected", []):
            pkg = affected.get("package", {})
            affected_packages.append({
                "name": pkg.get("name", ""),
                "ecosystem": pkg.get("ecosystem", ""),
                "versions": affected.get("versions", [])[:20],  # Limit
            })

    return {
        "cve": cve_id,
        "severity": severity.capitalize(),
        "cvss_score": cvss_score,
        "cvss_vector": cvss_vector,
        "description": desc[:500],  # Allow longer summary
        "references": references,
        "cwe_ids": cwe_ids[:5],
        "affected_packages": affected_packages,
        "published_date": cve.get("published", ""),
        "last_modified": cve.get("lastModified", ""),
    }


def fetch_latest_cves():
    """Fetch the latest CVEs from NVD API and enrich with OSV, then update the database."""
    print("Fetching latest CVEs from NVD API...")

    all_new_cves = []
    start_index = 0
    results_per_page = 50
    max_pages = 5  # Limit to 250 CVEs per run

    for page in range(max_pages):
        data = fetch_nvd_cves(start_index, results_per_page)
        if not data:
            break

        cve_items = data.get("vulnerabilities", [])
        if not cve_items:
            break

        for item in cve_items:
            cve_id = item.get("cve", {}).get("id")
            if not cve_id:
                continue

            # Fetch OSV enrichment (optional, for affected packages)
            osv_data = fetch_osv_vuln(cve_id)

            cve_details = extract_cve_details(item, osv_data)
            all_new_cves.append(cve_details)

        # Check if more pages
        total_results = data.get("totalResults", 0)
        if start_index + results_per_page >= total_results:
            break
        start_index += results_per_page

    if not all_new_cves:
        print("No new CVEs found.")
        return

    print(f"Processing {len(all_new_cves)} CVEs from NVD...")

    db: Session = SessionLocal()
    try:
        cve_ids = [item["cve"] for item in all_new_cves]
        # Check which CVEs already exist in database
        existing_cves = db.query(CveTable.cve).filter(CveTable.cve.in_(cve_ids)).all()
        existing_ids = {r[0] for r in existing_cves}

        to_insert = []
        to_update = []

        for item in all_new_cves:
            if item["cve"] not in existing_ids:
                to_insert.append(CveTable(
                    cve=item["cve"],
                    severity=item["severity"],
                    affected_sector=item["description"],  # Use description as sector for now
                ))
            else:
                # Could update existing records with new severity/info
                to_update.append(item)

        if to_insert:
            print(f"Adding {len(to_insert)} new CVEs to the database.")
            db.bulk_save_objects(to_insert)
            db.commit()
        else:
            print("No new CVEs to insert.")

        if to_update:
            print(f"Found {len(to_update)} existing CVEs (updates not implemented in basic schema).")

    except Exception as db_err:
        db.rollback()
        print(f"Database error during CVE insertion: {db_err}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run the fetch_latest_cves job every 12 hours
    scheduler.add_job(fetch_latest_cves, 'interval', hours=12)
    # Also trigger once on startup (with small delay)
    scheduler.add_job(fetch_latest_cves, 'date', run_date=datetime.utcnow() + timedelta(seconds=30))
    scheduler.start()
    print("Background Scheduler Started: Live NVD + OSV CVE Threat Feed Active.")
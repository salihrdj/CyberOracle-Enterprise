#  CyberOracle Enterprise

**CyberOracle Enterprise** is an enterprise-grade, intelligence-driven cybersecurity threat intelligence, vulnerability scanning, and predictive analytics suite. It merges full-stack web engineering, machine learning-driven threat forecasting, multi-provider generative AI diagnostics, and network-level security scanning into a unified, high-performance dashboard.

---

##  Architecture Overview

```mermaid
graph TD
    User([Security Analyst]) -->|Interacts| Frontend[Next.js / Vite Dashboard]
    
    subgraph Frontend Layer
        Frontend -->|Visualizations| Recharts[Recharts Analytics]
        Frontend -->|State Management| Zustand[Zustand Store]
        Frontend -->|Styling| Tailwind[Tailwind CSS]
    end

    Frontend -->|API Requests / WebSockets| Backend[FastAPI Backend Server]

    subgraph Backend Core
        Backend -->|Queries & Updates| DB[(PostgreSQL Database)]
        Backend -->|JWT Auth & Rotations| Auth[Argon2id & JWT Auth Engine]
        Backend -->|Triggers Background Jobs| Scheduler[APScheduler Core]
        Backend -->|Generates PDFs| ReportGen[ReportLab PDF Compiler]
    end

    subgraph Scanner & Security Engines
        Scheduler -->|Invokes| Scanner[Pro Vulnerability Scanner]
        Scanner -->|Vulnerability Mapping| CVE[CVE Knowledge Base]
        Scanner -->|IP Reputation Check| OTX[AlienVault OTX API]
        Backend -->|Audit Logs| Audits[Security Audit Logs]
        Backend -->|System Metrics| Psutil[psutil Resource Monitor]
    end

    subgraph Prediction & AI Layer
        Backend -->|ML Inference| ML[Scikit-learn RF Engine]
        Backend -->|AI Explanations| AI[Groq / Gemini / Claude API]
    end

    subgraph Automation & External Feeds
        Backend -->|Webhooks| N8N[n8n Automation Engine]
        N8N -->|Alerts & Notifications| Slack[Slack / Email Notifications]
        Backend -->|Threat Intake| VT[VirusTotal API]
    end
```

---

##  Key Capabilities

### 1. Multi-Engine AI Threat Analyst
- **Real-Time Streamed Analysis**: Uses a custom AI Analyst orchestrator supporting **Groq (LLaMA 3.3)**, **Google Gemini 2.0 Flash**, and **Anthropic Claude 3.5 Sonnet** to deliver streamed, highly technical threat explanations and remediation guides.
- **Context-Aware Diagnostics**: Feeds scanner data, host status, and CVE indicators into the LLM system prompt to analyze system-specific risks.

### 2. Predictive ML Forecasting
- **Random Forest Regressors & Classifiers**: Machine learning engine trained with Scikit-learn to forecast future attack frequencies, regional threat indices, and growth probabilities.
- **Model Security & Integrity**: Automatically computes SHA256 hashes of trained model files (`rf_threat_model.joblib`, `rf_growth_model.joblib`) and verifies their integrity on startup to protect against adversarial payload tempering.

### 3. Advanced Vulnerability Scanner
- **Multi-Threaded Scanner**: Concurrent scanner targeting critical enterprise services (FTP, SSH, SMB, RDP, Database systems, Kubernetes, etc.) on safe ranges.
- **Threat Intelligence Enrichment**: Cross-references open ports with custom-mapped CVE databases and queries **AlienVault OTX** and **VirusTotal** reputation indicators.
- **Authorization Guard**: Features a strict target validation layer (`scan_validator.py`) to restrict loopback scans and control internal network probing based on environment policies.

### 4. Enterprise Security & Identity
- **Next-Gen Password Hashing**: Utilizes high-security **Argon2id** hashing with automatic migration/upgrading of legacy bcrypt passwords upon user login.
- **JWT Secret Rotation**: Native token verification supporting cryptographic key rotation. Validates sessions against a rotated JSON key matrix while signing new tokens with active keys.
- **Audit Trails**: Full system audit logging tracking actions, target modifications, system logins, and scanned IP targets.

### 5. Automated Workflows & PDF Reports
- **n8n Orchestration**: Features a production-ready `workflow.json` to trigger automated workflows, notifications, and webhooks on critical alerts.
- **PDF Compiler**: Utilizes ReportLab to compile clean, enterprise-ready PDF audit summaries and scan reports on demand.
- **APScheduler**: Manages background scanning intervals, intelligence feed synchronization, and resource auditing.

---

##  Repository Directory Structure

```text
├── backend/
│   ├── main.py                # FastAPI main application & API endpoints
│   ├── database.py            # SQLAlchemy schema models & database session 
│   ├── init_db.py             # DB creation, migration from SQLite & seed scripts
│   ├── pro_scanner.py         # Concurrent port & service vulnerability scanner
│   ├── scan_validator.py      # Scan policy validator & authorization checker
│   ├── ml_engine.py           # Scikit-learn model definitions, training, and hashing
│   ├── ai_analyst.py          # Groq, Gemini, and Claude API prompt & stream integrations
│   ├── report_generator.py    # ReportLab PDF design and generation script
│   ├── scheduler.py           # APScheduler background tasks config
│   ├── alembic/               # Database schema migration history
│   └── requirements.txt       # Backend Python dependencies
├── frontend/
│   ├── src/                   # React dashboard source files
│   ├── package.json           # Frontend dependency manifest
│   ├── next.config.mjs        # Next.js configurations
│   ├── vite.config.js         # Vite dev configurations
│   └── tailwind.config.ts     # UI theme styling and layouts
├── n8n/
│   └── workflow.json          # Pre-configured n8n integration workflow
├── start.bat                  # One-click Windows database and services launcher
└── README.md                  # Project documentation
```

---

##  Getting Started

### Prerequisites
- Python 3.9+
- Node.js (v18+)
- PostgreSQL 18+

### 1. Database Configuration
Make sure your PostgreSQL instance is running. Create a database named `cyber_db` (or name of your choice).

### 2. Backend Installation & Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
3. Install the required libraries:
   ```bash
   pip install -r requirements.txt
   ```
4. Create your `.env` configuration file (refer to `.env.example`):
   ```ini
   SECRET_KEY=generate_your_openssl_hex_string
   DATABASE_URL=postgresql://postgres:password@localhost:5432/cyber_db
   AI_PROVIDER=groq  # Choices: groq, gemini, claude
   GROQ_API_KEY=your_key
   GEMINI_API_KEY=your_key
   CLAUDE_API_KEY=your_key
   ```
5. Initialize the database schema and migrate data from legacy SQLite:
   ```bash
   # Sets up PostgreSQL schemas & migrates existing intelligence records
   python init_db.py
   ```

### 3. Frontend Installation
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install the JavaScript node modules:
   ```bash
   npm install
   ```

### 4. Running the Application

For a unified experience, execute the launcher script from the repository root:
```bash
# Verifies PostgreSQL, launches FastAPI, launches Vite dev server, and opens http://127.0.0.1:5173
start.bat
```

To run services manually:
- **Backend**: `cd backend && python main.py` (FastAPI runs on `http://127.0.0.1:8000`)
- **Frontend**: `cd frontend && npm run dev` (Vite dev server hosts on `http://127.0.0.1:5173`)

---

## License

This enterprise platform is distributed under the MIT License. Detail specifications can be found in the LICENSE file.

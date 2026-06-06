import os
import socket
import concurrent.futures
import ipaddress
from datetime import datetime
from typing import List, Dict, Optional

# ── Port & Service Definitions ────────────────────────────────────────────────
FULL_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    69: "TFTP", 80: "HTTP", 110: "POP3", 111: "RPCBIND", 119: "NNTP",
    135: "MS-RPC", 137: "NetBIOS-NS", 138: "NetBIOS-DGM", 139: "NetBIOS-SSN",
    143: "IMAP", 161: "SNMP", 194: "IRC", 389: "LDAP", 443: "HTTPS",
    445: "SMB", 465: "SMTPS", 500: "IKE", 512: "REXEC", 513: "RLOGIN",
    514: "SYSLOG", 515: "LPD", 587: "SMTP-TLS", 631: "IPP", 636: "LDAPS",
    873: "RSYNC", 993: "IMAPS", 995: "POP3S", 1080: "SOCKS",
    1194: "OpenVPN", 1433: "MSSQL", 1521: "Oracle", 1723: "PPTP",
    2049: "NFS", 2121: "FTP-Alt", 2375: "Docker", 2376: "Docker-TLS",
    3000: "Dev-Server", 3306: "MySQL", 3389: "RDP", 4444: "Metasploit",
    4848: "GlassFish", 5432: "PostgreSQL", 5900: "VNC", 5985: "WinRM",
    6379: "Redis", 6443: "Kubernetes", 7001: "WebLogic", 8000: "HTTP-Dev",
    8080: "HTTP-Proxy", 8443: "HTTPS-Alt", 8888: "Jupyter", 9200: "Elasticsearch",
    9300: "Elasticsearch-TCP", 10250: "Kubelet", 27017: "MongoDB",
    27018: "MongoDB-Shard", 50000: "SAP",
}

# ── CVE Knowledge Base ────────────────────────────────────────────────────────
CVE_MAP = {
    "FTP":           [{"cve": "CVE-2021-3156",  "severity": "High",     "description": "sudo heap overflow, often co-exploited with anon FTP."},
                      {"cve": "CVE-2001-0553",  "severity": "Critical", "description": "WU-FTPD remote root via format string."}],
    "SSH":           [{"cve": "CVE-2023-38408", "severity": "Critical", "description": "OpenSSH agent remote code execution."},
                      {"cve": "CVE-2018-15473", "severity": "Medium",   "description": "OpenSSH username enumeration."}],
    "Telnet":        [{"cve": "CVE-2011-4862",  "severity": "Critical", "description": "Telnet encrypt_keyid() buffer overflow — cleartext also a risk."}],
    "SMTP":          [{"cve": "CVE-2020-7247",  "severity": "Critical", "description": "OpenSMTPD remote code execution."}],
    "DNS":           [{"cve": "CVE-2020-1350",  "severity": "Critical", "description": "SigRed — Windows DNS Server RCE (wormable)."}],
    "HTTP":          [{"cve": "CVE-2021-41773", "severity": "Critical", "description": "Apache HTTP Server path traversal & RCE."},
                      {"cve": "CVE-2014-6271",  "severity": "Critical", "description": "Shellshock — Bash CGI remote code execution."}],
    "HTTPS":         [{"cve": "CVE-2014-0160",  "severity": "Critical", "description": "Heartbleed — OpenSSL memory disclosure."},
                      {"cve": "CVE-2016-2107",  "severity": "High",     "description": "OpenSSL Padding Oracle (POODLE/DROWN)."}],
    "SMB":           [{"cve": "CVE-2017-0144",  "severity": "Critical", "description": "EternalBlue — SMB remote code execution (WannaCry)."},
                      {"cve": "CVE-2020-0796",  "severity": "Critical", "description": "SMBGhost — SMBv3 remote code execution."}],
    "RDP":           [{"cve": "CVE-2019-0708",  "severity": "Critical", "description": "BlueKeep — RDP pre-auth remote code execution."},
                      {"cve": "CVE-2021-34535", "severity": "Critical", "description": "RDP client RCE via malicious server."}],
    "MySQL":         [{"cve": "CVE-2016-6662",  "severity": "Critical", "description": "MySQL privilege escalation via config injection."}],
    "PostgreSQL":    [{"cve": "CVE-2019-9193",  "severity": "High",     "description": "PostgreSQL arbitrary code execution via COPY."}],
    "MongoDB":       [{"cve": "CVE-2019-2389",  "severity": "High",     "description": "MongoDB unauthorized access on default config."}],
    "Redis":         [{"cve": "CVE-2022-0543",  "severity": "Critical", "description": "Redis Lua sandbox escape — RCE."}],
    "Elasticsearch": [{"cve": "CVE-2021-22145", "severity": "High",     "description": "Elasticsearch OOM via malicious query."}],
    "MSSQL":         [{"cve": "CVE-2020-0618",  "severity": "Critical", "description": "SQL Server Reporting Services RCE."}],
    "SNMP":          [{"cve": "CVE-2017-6736",  "severity": "Critical", "description": "Cisco IOS SNMP remote code execution."}],
    "LDAP":          [{"cve": "CVE-2021-44228", "severity": "Critical", "description": "Log4Shell via LDAP JNDI injection."}],
    "VNC":           [{"cve": "CVE-2019-15681", "severity": "Critical", "description": "LibVNCServer memory leak — credential exposure."}],
    "Docker":        [{"cve": "CVE-2019-5736",  "severity": "Critical", "description": "runc container escape."}],
    "Kubernetes":    [{"cve": "CVE-2018-1002105","severity": "Critical", "description": "Kubernetes API server privilege escalation."}],
    "Jupyter":       [{"cve": "CVE-2022-24758", "severity": "High",     "description": "Jupyter notebook arbitrary file access."}],
    "WebLogic":      [{"cve": "CVE-2021-2394",  "severity": "Critical", "description": "WebLogic deserialization RCE."}],
    "MS-RPC":        [{"cve": "CVE-2003-0352",  "severity": "Critical", "description": "MS03-026 — DCOM RPC buffer overflow (Blaster worm)."}],
    "WinRM":         [{"cve": "CVE-2021-31166", "severity": "Critical", "description": "HTTP.sys use-after-free in WinRM transport."}],
}


# ── Core Scanner Functions ────────────────────────────────────────────────────

def is_authorized_target(ip_str: str) -> bool:
    """Validates target IP address blocks, restricting private subnets unless explicitly enabled in configuration."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback:
            return False
        is_cloud = os.getenv("RENDER") is not None or os.getenv("VERCEL") is not None
        default_allow = "true" if not is_cloud else "false"
        allow_internal = os.getenv("ALLOW_INTERNAL_SCANS", default_allow).lower() == "true"
        if ip.is_private or ip.is_link_local or ip.is_multicast:
            return allow_internal
        return True
    except ValueError:
        return False

def resolve_target(target: str) -> List[str]:
    """
    Given any target (IP, hostname, CIDR, or domain), return a list of IPs to scan.
    """
    target = target.strip()
    ips = []

    # Try CIDR subnet (e.g. 192.168.1.0/24)
    try:
        net = ipaddress.ip_network(target, strict=False)
        ips = [str(host) for host in net.hosts()]
        return ips
    except ValueError:
        pass

    # Try resolving as hostname / domain
    try:
        resolved = socket.getaddrinfo(target, None)
        ips = list({r[4][0] for r in resolved})
        return ips
    except socket.gaierror:
        pass

    return []


def grab_banner(ip: str, port: int, timeout: float = 2.0) -> str:
    """Attempt to read a banner from an open port."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((ip, port))
        # Send a generic probe
        try:
            sock.send(b"HEAD / HTTP/1.0\r\n\r\n")
        except Exception:
            pass
        banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()
        sock.close()
        return banner[:200]  # Truncate long banners
    except Exception:
        return ""


def guess_os(ttl: Optional[int]) -> str:
    """Guess OS from TTL value."""
    if ttl is None:
        return "Unknown"
    if ttl <= 64:
        return "Linux / Unix"
    if ttl <= 128:
        return "Windows"
    return "Network Device / Router"


def get_ttl(ip: str) -> Optional[int]:
    """Get TTL by connecting to a common port and reading socket info."""
    for port in [80, 443, 22, 135]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1.0)
            sock.connect((ip, port))
            # TTL not directly accessible in Python's socket, use a heuristic
            sock.close()
            # We'll default to returning None here — OS guess will be "Unknown"
            # In a production tool, this would use raw sockets (requires root/admin)
            return None
        except Exception:
            continue
    return None


def check_port(ip: str, port: int, timeout: float = 1.5) -> Optional[Dict]:
    """Check a single port. Returns result dict if open, None if closed."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((ip, port))
        if result == 0:
            return {"port": port, "service": FULL_PORTS.get(port, f"Unknown-{port}")}
    except socket.error:
        pass
    finally:
        sock.close()
    return None


def scan_host(ip: str) -> Dict:
    """Full port scan + banner grab + CVE mapping for a single host."""
    open_ports = []

    scan_concurrency = int(os.getenv("SCAN_CONCURRENCY", "10"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=scan_concurrency) as executor:
        futures = {executor.submit(check_port, ip, port): port for port in FULL_PORTS}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                open_ports.append(result)

    # Enrich each open port
    for p in open_ports:
        svc = p["service"]
        # Banner grab
        p["banner"] = grab_banner(ip, p["port"])
        # CVE lookup
        vulns = CVE_MAP.get(svc, [])
        if not vulns and p["banner"]:
            # Try to match banner keywords
            for key, v in CVE_MAP.items():
                if key.lower() in p["banner"].lower():
                    vulns = v
                    break
        p["vulnerabilities"] = vulns

    open_ports.sort(key=lambda x: x["port"])

    # Resolve hostname
    hostname = ""
    try:
        hostname = socket.gethostbyaddr(ip)[0]
    except Exception:
        pass

    return {
        "ip": ip,
        "hostname": hostname,
        "os_guess": "Unknown",  # Would need raw sockets for real TTL fingerprinting
        "open_ports": open_ports
    }


def is_host_alive(ip: str, timeout: float = 1.0) -> bool:
    """Quick TCP ping to check if a host is alive."""
    for port in [80, 443, 22, 445, 3389, 8080]:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            if sock.connect_ex((ip, port)) == 0:
                sock.close()
                return True
        except Exception:
            pass
        finally:
            sock.close()
    return False


def discover_hosts(ips: List[str], progress_callback=None) -> List[str]:
    """Parallel ping sweep to find live hosts in a list of IPs."""
    live = []
    done = 0

    def check(ip):
        nonlocal done
        alive = is_host_alive(ip)
        done += 1
        if progress_callback:
            progress_callback(done, len(ips))
        return ip if alive else None

    scan_concurrency = int(os.getenv("SCAN_CONCURRENCY", "10"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=scan_concurrency) as executor:
        futures = [executor.submit(check, ip) for ip in ips]
        for f in concurrent.futures.as_completed(futures):
            result = f.result()
            if result:
                live.append(result)

    return sorted(live, key=lambda x: list(map(int, x.split("."))))


def full_engagement_scan(target: str, scan_id: int, db_session) -> Dict:
    """
    Full professional scan:
    1. Resolve target to list of IPs
    2. Discover live hosts
    3. Full port scan each live host
    4. Save everything to the DB
    Returns summary dict.
    """
    from database import ScanHost, OpenPort, Scan
    from datetime import datetime

    # Update scan status to running
    scan = db_session.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        return {"error": "Scan not found"}
    scan.status = "running"
    db_session.commit()

    try:
        # Step 1: Resolve
        ips = resolve_target(target)
        if not ips:
            # Single IP fallback
            try:
                ipaddress.ip_address(target)
                ips = [target]
            except ValueError:
                scan.status = "failed"
                scan.ai_summary = f"[SCAN ERROR] Cannot resolve target hostname or IP range: {target}"
                db_session.commit()
                return {"error": f"Cannot resolve target: {target}"}

        # Filter to authorized targets only
        unauthorized_ips = [ip for ip in ips if not is_authorized_target(ip)]
        ips = [ip for ip in ips if is_authorized_target(ip)]
        
        if not ips:
            scan.status = "failed"
            if unauthorized_ips:
                scan.ai_summary = "[SCAN ERROR] Target contains private or unauthorized subnets (scanning blocked in cloud environment). Please run CyberOracle locally via start.bat to scan local/private networks."
                db_session.commit()
                return {"error": "Target contains private or unauthorized subnets (scanning blocked)."}
            scan.ai_summary = f"[SCAN ERROR] No valid target IPs resolved from: {target}"
            db_session.commit()
            return {"error": f"No valid target IPs resolved from: {target}"}

        # Step 2: Discover live hosts (skip discovery for single IPs)
        if len(ips) == 1:
            live_ips = ips
        else:
            live_ips = discover_hosts(ips)

        # Step 3: Full port scan each host
        all_results = []
        for ip in live_ips:
            host_result = scan_host(ip)

            # Persist host to DB
            db_host = ScanHost(
                scan_id=scan_id,
                ip=host_result["ip"],
                hostname=host_result["hostname"],
                os_guess=host_result["os_guess"]
            )
            db_session.add(db_host)
            db_session.flush()  # Get db_host.id

            # Persist open ports
            for p in host_result["open_ports"]:
                for vuln in (p.get("vulnerabilities") or [{}]):
                    db_port = OpenPort(
                        host_id=db_host.id,
                        port=p["port"],
                        service=p["service"],
                        banner=p.get("banner", ""),
                        cve=vuln.get("cve", ""),
                        severity=vuln.get("severity", ""),
                        description=vuln.get("description", "")
                    )
                    db_session.add(db_port)

            all_results.append(host_result)

        db_session.commit()
        scan.status = "complete"
        scan.finished_at = datetime.utcnow()
        db_session.commit()

        return {"live_hosts": len(live_ips), "results": all_results}

    except Exception as e:
        scan.status = "failed"
        scan.ai_summary = f"[SCAN ERROR] Exception occurred during active scan: {str(e)}"
        db_session.commit()
        return {"error": str(e)}

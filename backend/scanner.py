import os
import ipaddress
import socket
import concurrent.futures
from typing import Dict, List

# Common ports and their typical services
COMMON_PORTS = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    8080: "HTTP-Proxy",
    27017: "MongoDB"
}

def is_authorized_target(ip_str: str) -> bool:
    """Validates target IP address blocks, restricting private subnets unless explicitly enabled in configuration."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback:
            return False
        # SECURITY: Always default to false for internal scans regardless of environment
        # Internal scanning must be explicitly enabled via ALLOW_INTERNAL_SCANS=true
        allow_internal = os.getenv("ALLOW_INTERNAL_SCANS", "false").lower() == "true"
        if ip.is_private or ip.is_link_local or ip.is_multicast:
            return allow_internal
        return True
    except ValueError:
        return False

def check_port(ip: str, port: int, timeout: float = 1.0) -> Dict:
    """Check if a specific port is open on the target IP."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((ip, port))
        if result == 0:
            return {"port": port, "service": COMMON_PORTS.get(port, "Unknown"), "state": "open"}
    except socket.error:
        pass
    finally:
        sock.close()
    return {"port": port, "service": COMMON_PORTS.get(port, "Unknown"), "state": "closed"}

def scan_target(ip: str, ports: List[int] = None) -> List[Dict]:
    """Scan a target IP for open ports using multi-threading."""
    if not is_authorized_target(ip):
        raise ValueError("Target contains private or unauthorized subnets (scanning blocked).")
        
    if ports is None:
        ports = list(COMMON_PORTS.keys())
    
    open_ports = []
    # Use ThreadPoolExecutor with controlled concurrency
    scan_concurrency = int(os.getenv("SCAN_CONCURRENCY", "10"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=scan_concurrency) as executor:
        futures = {executor.submit(check_port, ip, port): port for port in ports}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result["state"] == "open":
                open_ports.append(result)
                
    # Map to potential vulnerabilities (Simulated lookup against NVD for now)
    for p in open_ports:
        service = p["service"]
        p["vulnerabilities"] = []
        if service == "FTP":
            p["vulnerabilities"].append({"cve": "CVE-2021-3156", "severity": "High", "description": "Potential unauthorized access in legacy FTP."})
        elif service == "SMB":
            p["vulnerabilities"].append({"cve": "CVE-2017-0144", "severity": "Critical", "description": "EternalBlue SMB Remote Code Execution."})
        elif service == "RDP":
            p["vulnerabilities"].append({"cve": "CVE-2019-0708", "severity": "Critical", "description": "BlueKeep RDP Remote Code Execution."})
            
    # Sort by port number
    open_ports.sort(key=lambda x: x["port"])
    return open_ports

import socket
import subprocess
import json
import sys
import psutil

def get_local_ip():
    """Returns the primary active local IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def check_firewall():
    """Checks Firewall status dynamically based on OS platform."""
    if sys.platform != "win32":
        # Heuristic check for non-Windows firewall (e.g. Linux UFW/iptables)
        try:
            # Try to run ufw status
            out = subprocess.check_output(['ufw', 'status'], stderr=subprocess.STDOUT).decode()
            is_on = "active" in out.lower() and "inactive" not in out.lower()
            return {
                "status": "enabled" if is_on else "disabled",
                "secure": is_on,
                "raw": out.strip()[:100]
            }
        except Exception:
            # Fallback to checking if iptables is present
            try:
                out = subprocess.check_output(['which', 'iptables']).decode()
                return {
                    "status": "enabled (iptables)",
                    "secure": True,
                    "raw": f"iptables located at: {out.strip()}"
                }
            except Exception as e:
                return {"status": "disabled/unknown", "secure": False, "raw": f"No firewall tools detected: {str(e)}"}

    # Windows platform firewall check
    try:
        # Run safely without shell=True
        out = subprocess.check_output(['netsh', 'advfirewall', 'show', 'allprofiles', 'state']).decode()
        is_on = "ON" in out.upper()
        return {
            "status": "enabled" if is_on else "disabled",
            "secure": is_on,
            "raw": out.strip()[:100]
        }
    except Exception as e:
        return {"status": "error", "secure": False, "raw": f"Failed to retrieve firewall status: {str(e)}"}

def check_defender():
    """Checks Antivirus/Windows Defender status based on OS platform."""
    if sys.platform != "win32":
        # Check common Linux security/AV components (AppArmor, SELinux)
        active_daemons = []
        for daemon in ["apparmor", "selinux", "clamd"]:
            try:
                subprocess.check_output(["systemctl", "is-active", daemon], stderr=subprocess.STDOUT)
                active_daemons.append(daemon)
            except Exception:
                continue
        
        is_secure = len(active_daemons) > 0
        return {
            "status": "enabled" if is_secure else "disabled",
            "secure": is_secure,
            "details": {"active_security_services": active_daemons, "platform": sys.platform}
        }

    # Windows Defender check using PowerShell (without shell=True)
    try:
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command",
               "Get-MpComputerStatus | Select-Object AMServiceEnabled, AntispywareEnabled, RealTimeProtectionEnabled | ConvertTo-Json"]
        out = subprocess.check_output(cmd).decode()
        data = json.loads(out)
        
        secure = data.get("AMServiceEnabled", False) and data.get("RealTimeProtectionEnabled", False)
        
        return {
            "status": "enabled" if secure else "disabled",
            "secure": secure,
            "details": data
        }
    except Exception as e:
        return {"status": "error", "secure": False, "raw": f"Failed to query Defender: {str(e)}"}

def get_active_connections():
    """Gets a count of active network connections using psutil."""
    try:
        connections = psutil.net_connections(kind='inet')
        established = [conn for conn in connections if conn.status == 'ESTABLISHED']
        count = len(established)
        
        raw_lines = []
        for conn in established[:5]:
            laddr = f"{conn.laddr.ip}:{conn.laddr.port}"
            raddr = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else "-"
            raw_lines.append(f"TCP {laddr} <-> {raddr} ESTABLISHED")
        
        raw_preview = "\n".join(raw_lines)
        if count > 5:
            raw_preview += "\n..."
            
        return {
            "established_connections": count,
            "raw": raw_preview or "No active established connections."
        }
    except Exception as e:
        return {"established_connections": 0, "raw": f"Error retrieving connections: {str(e)}"}

def full_system_scan():
    """Runs all checks and returns a comprehensive report."""
    return {
        "ip": get_local_ip(),
        "firewall": check_firewall(),
        "defender": check_defender(),
        "network": get_active_connections()
    }

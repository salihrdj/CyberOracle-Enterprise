import os
import ipaddress
from typing import List, Optional, Tuple
from fastapi import HTTPException

MAX_CIDR_PREFIXLEN = int(os.getenv("MAX_CIDR_PREFIXLEN", "24"))
MAX_HOSTS_PER_SCAN = int(os.getenv("MAX_HOSTS_PER_SCAN", "256"))
BLOCKED_NETWORKS = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "224.0.0.0/4",
    "240.0.0.0/4",
]

ALLOWED_NETWORKS_ENV = os.getenv("ALLOWED_SCAN_NETWORKS", "")
ALLOWED_NETWORKS = [n.strip() for n in ALLOWED_NETWORKS_ENV.split(",") if n.strip()]

DENIED_NETWORKS_ENV = os.getenv("DENIED_SCAN_NETWORKS", "")
DENIED_NETWORKS = [n.strip() for n in DENIED_NETWORKS_ENV.split(",") if n.strip()]

def parse_network(network_str: str) -> ipaddress.IPv4Network:
    return ipaddress.ip_network(network_str, strict=False)

BLOCKED_NETWORKS_PARSED = [parse_network(n) for n in BLOCKED_NETWORKS]
ALLOWED_NETWORKS_PARSED = [parse_network(n) for n in ALLOWED_NETWORKS] if ALLOWED_NETWORKS else []
DENIED_NETWORKS_PARSED = [parse_network(n) for n in DENIED_NETWORKS] if DENIED_NETWORKS else []

def is_ip_in_networks(ip: ipaddress.IPv4Address, networks: List[ipaddress.IPv4Network]) -> bool:
    return any(ip in net for net in networks)

def validate_scan_target(target: str) -> Tuple[List[str], str]:
    """
    Validate and parse a scan target.
    Returns (list_of_ips, target_type) where target_type is 'ip' or 'cidr'.
    Raises HTTPException on validation failure.
    """
    target = target.strip()
    
    if not target:
        raise HTTPException(status_code=400, detail="Target cannot be empty")
    
    # Try CIDR
    try:
        net = ipaddress.ip_network(target, strict=False)
        if net.prefixlen < MAX_CIDR_PREFIXLEN:
            raise HTTPException(
                status_code=400, 
                detail=f"CIDR prefix length must be >= {MAX_CIDR_PREFIXLEN} (max {2**(32-MAX_CIDR_PREFIXLEN)} hosts)"
            )
        
        num_hosts = net.num_addresses - 2 if net.num_addresses > 2 else 1
        if num_hosts > MAX_HOSTS_PER_SCAN:
            raise HTTPException(
                status_code=400,
                detail=f"CIDR too large: {num_hosts} hosts (max {MAX_HOSTS_PER_SCAN})"
            )
        
        ips = [str(host) for host in net.hosts()]
        if not ips:
            ips = [str(net.network_address)]
        
        return ips, "cidr"
    except ValueError:
        pass
    except HTTPException:
        raise
    
    # Try single IP
    try:
        ip = ipaddress.ip_address(target)
        return [str(ip)], "ip"
    except ValueError:
        pass
    
    raise HTTPException(status_code=400, detail="Invalid target format. Use IP address or CIDR notation.")

def check_scan_authorization(ips: List[str]) -> Tuple[List[str], List[str]]:
    """
    Check if IPs are authorized for scanning.
    Returns (authorized_ips, unauthorized_ips).
    """
    authorized = []
    unauthorized = []
    
    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            unauthorized.append(ip_str)
            continue
        
        # Check denied networks first (explicit deny)
        if is_ip_in_networks(ip, DENIED_NETWORKS_PARSED):
            unauthorized.append(ip_str)
            continue
        
        # If allowed networks configured, IP must be in one of them
        if ALLOWED_NETWORKS_PARSED:
            if not is_ip_in_networks(ip, ALLOWED_NETWORKS_PARSED):
                unauthorized.append(ip_str)
                continue
        
        # Check blocked networks (private, loopback, etc.)
        if is_ip_in_networks(ip, BLOCKED_NETWORKS_PARSED):
            allow_internal = os.getenv("ALLOW_INTERNAL_SCANS", "false").lower() == "true"
            if not allow_internal:
                unauthorized.append(ip_str)
                continue
        
        authorized.append(ip_str)
    
    return authorized, unauthorized
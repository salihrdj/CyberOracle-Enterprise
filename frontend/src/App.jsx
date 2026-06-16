'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area, ReferenceDot,
  PieChart, Pie
} from 'recharts';
import { 
  ShieldAlert, Activity, Search, Zap, Globe, Database, LayoutDashboard, 
  MessageSquare, Send, Briefcase, Plus, X, ChevronRight, Download, 
  RefreshCw, Shield, Settings, HelpCircle, Radio, LogOut, KeyRound, 
  Bell, Terminal, Cpu 
} from 'lucide-react';

const getApiBase = () => {
  let url = 'http://127.0.0.1:8000/api';
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) {
    url = process.env.NEXT_PUBLIC_API_URL;
  } else if (typeof window !== 'undefined') {
    if (window.location.port === '3000' || window.location.port === '5173') {
      url = 'http://127.0.0.1:8000/api';
    } else {
      url = '/api/backend';
    }
  }
  if (url !== '/api/backend' && !url.endsWith('/api') && !url.endsWith('/api/')) {
    url = url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

const apiBase = getApiBase();
const API = apiBase;

const getWsUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  const wsDefault = apiBase.startsWith('http')
    ? (apiBase.startsWith('https') 
        ? apiBase.replace('https://', 'wss://').replace('/api', '/ws/alerts')
        : apiBase.replace('http://', 'ws://').replace('/api', '/ws/alerts'))
    : (typeof window !== 'undefined'
        ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/alerts'
        : 'ws://127.0.0.1:8000/ws/alerts');
  return wsDefault;
};

const WS_URL = getWsUrl();
const TT = { 
  backgroundColor: 'rgba(15,15,30,0.9)', 
  border: '1px solid rgba(255,255,255,0.1)', 
  borderRadius: '12px', 
  color: '#e2e8f0', 
  backdropFilter: 'blur(10px)', 
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)' 
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TT, padding: '12px 16px' }}>
      <p className="text-xs text-txt-dim mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color || '#e2e8f0' }}>
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const GradientDefs = () => (
  <defs>
    <linearGradient id="barLavender" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.2} />
    </linearGradient>
    <linearGradient id="barSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.15} />
    </linearGradient>
    <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.15} />
    </linearGradient>
    <linearGradient id="barMint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#34d399" stopOpacity={0.15} />
    </linearGradient>
    <linearGradient id="barRose" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.15} />
    </linearGradient>
    <linearGradient id="barSkyH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15} />
      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.9} />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);

function App() {
  const getX = (lon) => {
    return 30.767 + ((lon + 180) / 360) * 784.077;
  };
  
  const getY = (lat) => {
    const latRad = (lat * Math.PI) / 180;
    const merc = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    return 470.9 - 74.0 * merc;
  };

  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soc_token') || '';
    }
    return '';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tabs navigation
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      const validTabs = ['siem', 'dashboard', 'clients', 'system', 'ai', 'forecast', 'network', 'scanner', 'intelligence'];
      if (lastPart && validTabs.includes(lastPart)) {
        return lastPart;
      }
    }
    return 'siem';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const targetPath = `/dashboard/${page}`;
      if (currentPath !== targetPath && (currentPath === '/' || currentPath.startsWith('/dashboard'))) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, [page]);

  // Global layouts & charts
  const [filter, setFilter] = useState('All');
  const [overview, setOverview] = useState(null);
  const [mapArcs, setMapArcs] = useState([]);
  const [mapPaths, setMapPaths] = useState([]);
  const [net, setNet] = useState(null);
  const [india, setIndia] = useState(null);
  const [tables, setTables] = useState(null);

  // Quick scanner
  const [ip, setIp] = useState('');
  const [ipRes, setIpRes] = useState(null);
  const [activeScanRes, setActiveScanRes] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Dynamic Trend Forecasts
  const [fReq, setFReq] = useState({ region: 'Global', year: 2026, month: 'Jan' });
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Streaming AI Chat
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', content: 'Hello! I am your AI Cyber Analyst. How can I assist you with threat intelligence today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Client Engagements Scan Wizard
  const [clients, setClients] = useState(null);
  const [newClientModal, setNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDesc, setNewClientDesc] = useState('');
  const [scanWizard, setScanWizard] = useState(null); // {clientId, step, clientName}
  const [scanTarget, setScanTarget] = useState('');
  const [activeScan, setActiveScan] = useState(null); 
  const [scanPollTimer, setScanPollTimer] = useState(null);
  const [scanReport, setScanReport] = useState(null); 

  // System Posture diagnostics
  const [sysHealth, setSysHealth] = useState(null);
  const [isSysScanning, setIsSysScanning] = useState(false);

  // ── Unified NextGen Live SOC Stream & Playbook States ──────────────────────
  const [liveIncidents, setLiveIncidents] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportDossier, setAiReportDossier] = useState("");
  const [n8nDispatchResult, setN8nDispatchResult] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [wsTrigger, setWsTrigger] = useState(0);
  const wsRef = useRef(null);

  const getHeaders = () => ({
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Fetch initial telemetry
  useEffect(() => {
    if (!token) return;
    if (page === 'dashboard') {
      axios.get(`${API}/overview?source=${filter}`, getHeaders()).then(r => setOverview(r.data)).catch(console.error);
    }
    if (page === 'network' && !net) { 
      axios.get(`${API}/network`, getHeaders()).then(r => setNet(r.data)).catch(console.error); 
      axios.get(`${API}/india`, getHeaders()).then(r => setIndia(r.data)).catch(console.error); 
    }
    if (page === 'intelligence' && !tables) {
      axios.get(`${API}/tables`, getHeaders()).then(r => setTables(r.data)).catch(console.error);
    }
    if (page === 'clients') {
      axios.get(`${API}/clients`, getHeaders()).then(r => setClients(r.data)).catch(console.error);
    }
  }, [page, filter, token]);

  // Fetch and parse world-map.svg paths
  useEffect(() => {
    fetch('/world-map.svg')
      .then(r => r.text())
      .then(svgText => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgText, 'image/svg+xml');
          const paths = Array.from(doc.querySelectorAll('path')).map(p => ({
            id: p.getAttribute('id') || Math.random().toString(),
            d: p.getAttribute('d')
          }));
          setMapPaths(paths);
        } catch (err) {
          console.error("Failed to parse map SVG:", err);
        }
      })
      .catch(err => console.error("Failed to fetch map SVG:", err));
  }, []);

  // Sync mapArcs with overview data initially
  useEffect(() => {
    if (overview && overview.map_arcs) {
      setMapArcs(overview.map_arcs);
    }
  }, [overview]);

  // Cleanup scan polling timer on unmount
  useEffect(() => {
    return () => {
      if (scanPollTimer) clearInterval(scanPollTimer);
    };
  }, [scanPollTimer]);

  // WebSocket Live Alert Stream Setup
  useEffect(() => {
    if (!token || (page !== 'siem' && page !== 'dashboard')) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isPolled = false;
    let pollInterval = null;
    let retryTimeoutId = null;

    const startPolling = () => {
      if (isPolled) return;
      isPolled = true;
      console.log("Starting HTTP fallback polling for SIEM alerts...");
      
      const fetchAlerts = async () => {
        if (!token) return;
        try {
          const res = await fetch(`${API}/threats/live`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.status === 401) {
            console.warn("Unauthorized API access (fetchAlerts) - logging out...");
            handleLogout();
            return;
          }
          if (res.ok) {
            const data = await res.json();
            setLiveIncidents(data);
            if (data.length > 0 && !selectedAlert) {
              setSelectedAlert(data[0]);
            }
          }
        } catch (err) {
          console.error("Failed to poll SIEM alerts:", err);
        }
      };

      fetchAlerts();
      pollInterval = setInterval(fetchAlerts, 10000);
    };

    const isPollOnly = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_POLL_ONLY === 'true';
    if (isPollOnly) {
      startPolling();
      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    const ws = new WebSocket(WS_URL, ["auth." + token]);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const msg = JSON.parse(event.data);
      if (msg.type === "INITIAL_CACHE") {
        setLiveIncidents(msg.data);
        if (msg.data.length > 0 && !selectedAlert) {
          setSelectedAlert(msg.data[0]);
        }
      } else if (msg.type === "NEW_ALERT") {
        if (!livePaused) {
          setLiveIncidents(prev => {
            const next = [msg.data, ...prev];
            return next.slice(0, 50);
          });
        }
        if (msg.data.origin_latitude && msg.data.origin_longitude) {
          const newArc = {
            id: msg.data.id || ("arc-" + Date.now()),
            origin: {
              city: msg.data.origin_city || msg.data.region || "Threat Origin",
              lat: msg.data.origin_latitude,
              lon: msg.data.origin_longitude
            },
            target: {
              city: msg.data.target_city || "Bangalore HQ",
              lat: msg.data.target_latitude || 12.9716,
              lon: msg.data.target_longitude || 77.5946
            },
            severity: msg.data.severity || 5
          };
          setMapArcs(prev => {
            const next = [...prev, newArc];
            return next.slice(-15);
          });
        }
      }
    };

    ws.onerror = (e) => {
      if (wsRef.current !== ws) return;
      console.error("WebSocket closed/error:", e);
      startPolling();
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      console.log("WebSocket stream closed.", event.code, event.reason);
      if (event.code === 4001) {
        console.warn("WebSocket closed due to auth failure - logging out...");
        handleLogout();
        return;
      }
      if (!isPolled) {
        retryTimeoutId = setTimeout(() => {
          if (wsRef.current !== ws) return;
          setWsTrigger(prev => prev + 1);
        }, 5000);
      }
    };

    return () => {
      if (wsRef.current === ws) {
        wsRef.current.close();
        wsRef.current = null;
      } else if (ws) {
        ws.close();
      }
      if (pollInterval) clearInterval(pollInterval);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [token, page, livePaused, wsTrigger]);

  // Authentication Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) throw new Error('Unauthorized credentials.');
      const data = await response.json();
      localStorage.setItem('soc_token', data.token || data.access_token);
      setToken(data.token || data.access_token);
    } catch (err) {
      setAuthError('Access Denied. Correct credentials: admin / Delta@920');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('soc_token');
    setToken('');
    setUsername('');
    setPassword('');
    setSelectedAlert(null);
    setAiReportDossier('');
    setN8nDispatchResult(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Global Axios Interceptor to handle token expiration (401 Unauthorized)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          console.warn("Unauthorized API access - logging out...");
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]);

  // Threat Quick Scanner
  const scanIp = () => {
    if (!ip) return;
    setIpRes(null); 
    setActiveScanRes(null); 
    setIsScanning(true);
    axios.get(`${API}/check-ip?ip=${ip}`, getHeaders()).then(r => setIpRes(r.data));
    axios.get(`${API}/scan?ip=${ip}`, getHeaders()).then(r => {
      setActiveScanRes(r.data);
      setIsScanning(false);
    }).catch(() => setIsScanning(false));
  };

  // Forecast predictors
  const predict = () => {
    setForecastLoading(true);
    setForecast(null);
    axios.post(`${API}/forecast`, fReq, getHeaders())
      .then(r => {
        setForecast(r.data);
        setForecastLoading(false);
      })
      .catch(err => {
        setForecast({ error: err.response?.data?.detail || err.message || 'Failed to fetch forecast.' });
        setForecastLoading(false);
      });
  };

  // Pluggable AI Analyst Q&A Streaming
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', content: q }, { role: 'ai', content: '' }]);
    setChatInput('');
    setIsChatting(true);
    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: q })
      });
      if (response.status === 401) {
        console.warn("Unauthorized API access (sendChat) - logging out...");
        handleLogout();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      setIsChatting(false);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setChatHistory(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0) {
            next[lastIdx] = {
              ...next[lastIdx],
              content: next[lastIdx].content + chunk
            };
          }
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setIsChatting(false);
    }
  };

  // AI Response Playbook Generator (SIEM Alert view)
  const generatePlaybookDossier = async (alertItem) => {
    if (!alertItem) return;
    setAiReportLoading(true);
    setAiReportDossier("");
    setN8nDispatchResult(null);
    try {
      const response = await fetch(`${API}/threats/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attack_type: alertItem.attack_type,
          industry: alertItem.industry,
          region: alertItem.region,
          severity: alertItem.severity,
          threat_score: alertItem.threat_score,
          growth_probability: alertItem.growth_probability,
          explainability: alertItem.explainability || {}
        })
      });
      if (response.status === 401) {
        console.warn("Unauthorized API access (generatePlaybookDossier) - logging out...");
        handleLogout();
        return;
      }
      if (response.ok) {
        const result = await response.json();
        setAiReportDossier(result.ai_analysis_report);
      }
    } catch (e) {
      console.error("AI Analysis failed:", e);
    } finally {
      setAiReportLoading(false);
    }
  };

  // Trigger n8n SOAR response webhooks
  const dispatchSoarWebhook = async (alertItem) => {
    if (!alertItem) return;
    setIsDispatching(true);
    setN8nDispatchResult(null);
    try {
      const payload = {
        predicted_risk_level: alertItem.risk_level || "HIGH",
        predicted_threat_score: alertItem.threat_score,
        predicted_growth_probability: alertItem.growth_probability,
        input: {
          attack_type: alertItem.attack_type,
          industry: alertItem.industry,
          region: alertItem.region,
          severity: alertItem.severity
        },
        recommended_actions: [
          `Isolate infected subnets running in ${alertItem.industry} target region.`,
          `Notify ${alertItem.region} operations lead immediately.`,
          `Flag threat signatures in local SIEM registry.`
        ]
      };
      const res = await axios.post(`${API}/threats/trigger-n8n`, payload, getHeaders());
      setN8nDispatchResult(res.data);
    } catch (e) {
      console.error("SOAR dispatch failed:", e);
    } finally {
      setIsDispatching(false);
    }
  };

  // Client Engagements scans helpers
  const createClient = () => {
    if (!newClientName.trim()) return;
    axios.post(`${API}/clients`, { name: newClientName, description: newClientDesc }, getHeaders())
      .then(() => { 
        setNewClientModal(false); 
        setNewClientName(''); 
        setNewClientDesc(''); 
        axios.get(`${API}/clients`, getHeaders()).then(r => setClients(r.data)); 
      });
  };
  const deleteClient = (id) => axios.delete(`${API}/clients/${id}`, getHeaders()).then(() => axios.get(`${API}/clients`, getHeaders()).then(r => setClients(r.data)));

  const launchScan = (clientId) => {
    if (!scanTarget.trim()) return;
    axios.post(`${API}/scans`, { client_id: clientId, target: scanTarget }, getHeaders())
      .then(r => {
        setActiveScan({ id: r.data.scan_id, status: 'pending' });
        setScanWizard({ step: 'progress', clientId, clientName: scanWizard.clientName });
        pollScan(r.data.scan_id);
      });
  };

  const pollScan = (scanId) => {
    const t = setInterval(() => {
      axios.get(`${API}/scans/${scanId}`, getHeaders()).then(r => {
        setActiveScan(r.data);
        if (r.data.status === 'complete' || r.data.status === 'failed') {
          clearInterval(t);
          if (r.data.status === 'complete') { 
            setScanReport(r.data); 
            setScanWizard({ step: 'report', clientName: scanWizard.clientName }); 
          }
        }
      });
    }, 3000);
    setScanPollTimer(t);
  };

  const NAV = [
    { id: 'siem', label: 'SIEM Live Monitor', icon: Radio },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients Scan', icon: Briefcase },
    { id: 'system', label: 'System Health', icon: Activity },
    { id: 'ai', label: 'AI Analyst', icon: MessageSquare },
    { id: 'forecast', label: 'Forecasting', icon: Zap },
    { id: 'network', label: 'Analytics Maps', icon: Globe },
    { id: 'scanner', label: 'Quick Scan', icon: Search },
    { id: 'intelligence', label: 'Threat Intel DB', icon: Database },
  ];

  // Holographic Gateway Login
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#04050e]">
        <div className="ambient"><div className="blob blob-1" /><div className="blob blob-2" /></div>
        <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl relative border border-white/10">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-lavender via-sky to-rose"></div>
          
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-16 h-16 bg-[#04050e] border border-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Shield className="w-7 h-7 text-sky animate-pulse" />
            </div>
            <h1 className="text-lg font-black tracking-widest text-slate-100 text-center uppercase">CyberOracle Enterprise</h1>
            <p className="text-[9px] text-sky tracking-widest uppercase mt-1.5 font-mono bg-sky/10 border border-sky/20 px-3 py-0.5 rounded-full">
              Authentication Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-txt-dim mb-2 font-mono">Operator Identity</label>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Operator ID (admin)"
                className="w-full bg-[#050510] border border-white/10 rounded-xl px-4 py-3 text-txt focus:outline-none focus:border-sky transition text-xs font-semibold font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-txt-dim mb-2 font-mono">Access Passphrase</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Access Token"
                className="w-full bg-[#050510] border border-white/10 rounded-xl px-4 py-3 text-txt focus:outline-none focus:border-sky transition text-xs font-semibold font-mono"
                required
              />
            </div>

            {authError && (
              <div className="text-[10px] text-rose bg-rose/10 border border-rose/20 p-3 rounded-xl font-mono">
                [ALERT] {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-lavender to-sky hover:brightness-110 text-white font-extrabold rounded-xl transition shadow-md flex justify-center items-center gap-2 border border-white/10 text-[10px] uppercase tracking-widest font-mono cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              {authLoading ? 'Clearance checks...' : 'Establish Session'}
            </button>
          </form>
          
          <div className="mt-8 text-center text-[8px] text-txt-faint font-mono tracking-widest uppercase border-t border-white/5 pt-4">
            ENCRYPTED LINK | LEVEL 3 COMPLIANCE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen relative">
      {/* Background decoration */}
      <div className="ambient"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /></div>

      {/* Sidebar Navigation */}
      <aside className="glass-sidebar w-[220px] flex flex-col py-6 px-4 z-10 shrink-0">
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-sky/20 flex items-center justify-center border border-sky/30">
            <Shield className="w-4 h-4 text-sky" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wide text-txt block">CyberOracle</span>
            <span className="text-[7.5px] text-sky font-mono font-bold uppercase tracking-wider">ENTERPRISE</span>
          </div>
        </div>
        
        <p className="text-[9px] font-bold text-txt-faint tracking-[0.2em] uppercase mb-3 px-3">Command Center</p>
        <nav className="space-y-0.5 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 cursor-pointer ${page === n.id ? 'bg-white/8 text-white font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] border-l-2 border-sky' : 'text-txt-dim hover:text-txt hover:bg-white/4'}`}>
              <n.icon className="w-4 h-4" />{n.label}
            </button>
          ))}
        </nav>
        
        <div className="border-t border-white/5 pt-4 space-y-2">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-1 text-[11px] font-mono text-txt-dim">
            <div className="flex justify-between text-[9px] text-txt-faint uppercase font-bold">
              <span>Security Clearance</span>
              <span className="text-sky">LVL 3</span>
            </div>
            <div className="truncate font-semibold">SOC Lead Analyst</div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-rose bg-rose/10 hover:bg-rose/25 rounded-xl transition cursor-pointer font-semibold uppercase tracking-wider font-mono justify-center"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto z-10 flex flex-col">
        {/* Top Header */}
        <header className="px-10 py-5 flex items-center justify-between border-b border-white/5">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {NAV.find(n => n.id === page)?.label || 'Overview'}
            </h1>
            <p className="text-xs text-txt-faint mt-0.5">Enterprise SOAR & Threat Intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            {page === 'dashboard' && (
              <select className="glass-input rounded-xl px-3 py-1.5 text-xs text-txt-dim" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="All">All Regions</option>
                <option value="India">India</option>
                <option value="Global">Global</option>
              </select>
            )}
            <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-txt-dim flex items-center gap-1.5 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              LIVE FEED
            </div>
          </div>
        </header>

        {/* Tab Views */}
        <div className="px-10 py-8 flex-1">
          
          {/* 1. SIEM LIVE MONITOR (Merged WebSocket SOC alert ingest) */}
          {page === 'siem' && (
            <div className="space-y-6">
              {/* Event stats cards */}
              <div className="grid grid-cols-4 gap-6">
                <div className="glass card-obsidian-info p-5">
                  <p className="text-[10px] text-txt-faint font-mono uppercase tracking-wider">Sensor Ingest Influx</p>
                  <p className={`text-2xl font-bold mt-1 ${livePaused ? "text-cyber-orange" : "text-cyber-green"}`}>
                    {livePaused ? "PAUSED" : "ACTIVE"}
                  </p>
                  <div className="metric-glow w-16" style={{ '--glow-color': '#34d399' }} />
                </div>
                <div className="glass card-obsidian-accent p-5">
                  <p className="text-[10px] text-txt-faint font-mono uppercase tracking-wider">Ingested Alerts</p>
                  <p className="text-2xl font-bold text-cyber-cyan mt-1">{liveIncidents.length}</p>
                  <div className="metric-glow w-16" style={{ '--glow-color': '#38bdf8' }} />
                </div>
                <div className="glass card-obsidian-critical p-5">
                  <p className="text-[10px] text-txt-faint font-mono uppercase tracking-wider">Critical Anomalies</p>
                  <p className="text-2xl font-bold text-cyber-red mt-1">
                    {liveIncidents.filter(i => i.risk_level === 'CRITICAL').length}
                  </p>
                  <div className="metric-glow w-16" style={{ '--glow-color': '#fb7185' }} />
                </div>
                <div className="glass card-obsidian-warning p-5">
                  <p className="text-[10px] text-txt-faint font-mono uppercase tracking-wider">Average Threat Score</p>
                  <p className="text-2xl font-bold text-cyber-orange mt-1">
                    {liveIncidents.length > 0
                      ? Math.round(liveIncidents.reduce((sum, item) => sum + item.threat_score, 0) / liveIncidents.length)
                      : 0}
                  </p>
                  <div className="metric-glow w-16" style={{ '--glow-color': '#fbbf24' }} />
                </div>
              </div>

              {/* Ingest Feed and AI Dossier Grid */}
              <div className="grid grid-cols-12 gap-6 items-stretch">
                {/* Live stream panel */}
                <div className="col-span-5 glass-strong p-6 flex flex-col h-[65vh]">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-txt-dim flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-sky animate-pulse" /> Live SIEM WebSocket Stream
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setLivePaused(!livePaused)}
                        className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-bold transition border ${livePaused ? 'bg-amber/10 border-amber text-amber' : 'bg-white/5 border-white/10 text-txt-dim'}`}
                      >
                        {livePaused ? 'Resume' : 'Pause'}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {liveIncidents.length === 0 ? (
                      <div className="text-center py-20 text-txt-faint text-xs font-mono">
                        Waiting for alerts from WebSocket channel...
                      </div>
                    ) : (
                      liveIncidents.map((incident) => {
                        const isCritical = incident.risk_level === 'CRITICAL';
                        const isHigh = incident.risk_level === 'HIGH';
                        const isMedium = incident.risk_level === 'MEDIUM';
                        const borderLeftColor = isCritical ? 'border-l-rose-500' : isHigh ? 'border-l-amber-500' : isMedium ? 'border-l-sky-500' : 'border-l-emerald-500';
                        return (
                          <div 
                            key={incident.id} 
                            onClick={() => {
                              setSelectedAlert(incident);
                              setAiReportDossier("");
                              setN8nDispatchResult(null);
                            }}
                            className={`p-3.5 rounded-xl border border-l-4 ${borderLeftColor} obsidian-item-hover transition cursor-pointer ${selectedAlert?.id === incident.id ? 'bg-white/10 border-sky/30 shadow-md' : 'bg-white/5 border-white/5'}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-semibold text-white">{incident.attack_type}</p>
                                <p className="text-[10px] text-txt-dim mt-0.5">{incident.industry} · {incident.region}</p>
                              </div>
                              <div className="text-right">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${isCritical ? 'obsidian-badge-critical' : isHigh ? 'obsidian-badge-high' : isMedium ? 'obsidian-badge-medium' : 'obsidian-badge-low'}`}>
                                  {incident.risk_level}
                                </span>
                                <p className="text-[9px] text-txt-faint mt-1 font-mono">{incident.timestamp.split(' ')[1]}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected alert detail & playbooks */}
                <div className="col-span-7 flex flex-col gap-6">
                  {selectedAlert ? (
                    <div className="glass-strong p-6 flex flex-col flex-1 h-[65vh] overflow-y-auto space-y-6">
                      <div className="flex justify-between items-start border-b border-white/5 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-sky font-mono font-bold tracking-widest bg-sky/10 border border-sky/20 px-2.5 py-0.5 rounded-md">
                              {selectedAlert.id}
                            </span>
                            <span className="text-xs text-txt-faint font-mono">{selectedAlert.timestamp}</span>
                          </div>
                          <h2 className="text-lg font-bold text-white mt-2">
                            {selectedAlert.attack_type} target at {selectedAlert.industry}
                          </h2>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-txt-faint uppercase font-bold tracking-wider font-mono">ML Threat Score</p>
                          <p className="text-3xl font-black font-mono text-white mt-1">
                            {selectedAlert.threat_score}<span className="text-xs text-txt-faint">/100</span>
                          </p>
                        </div>
                      </div>

                      {/* Enrichment cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 font-mono text-[11px] space-y-2">
                          <p className="text-[9px] text-txt-faint uppercase font-bold tracking-wider">Splunk Enterprise Indexer</p>
                          <div className="flex justify-between">
                            <span className="text-txt-dim">Events:</span>
                            <span className="text-txt font-semibold">{selectedAlert.enrichment?.splunk?.total_correlated_events} logs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-txt-dim">Status:</span>
                            <span className="text-rose font-semibold">SIG MATCH</span>
                          </div>
                          <div className="text-[9px] text-txt-faint bg-black/30 p-2 rounded truncate mt-1">
                            {selectedAlert.enrichment?.splunk?.raw_payloads?.[0]}
                          </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 font-mono text-[11px] space-y-2">
                          <p className="text-[9px] text-txt-faint uppercase font-bold tracking-wider">VirusTotal Reputation</p>
                          <div className="flex justify-between">
                            <span className="text-txt-dim">Status:</span>
                            <span className={`font-semibold ${selectedAlert.enrichment?.virustotal?.reputation_rating === 'MALICIOUS' ? 'text-rose' : 'text-mint'}`}>
                              {selectedAlert.enrichment?.virustotal?.reputation_rating}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-txt-dim">Malicious votes:</span>
                            <span className="text-txt font-semibold">{selectedAlert.enrichment?.virustotal?.malicious_votes}/75</span>
                          </div>
                          <div className="flex justify-between text-[9.5px]">
                            <span className="text-txt-faint font-bold">Kaspersky:</span>
                            <span className="text-rose font-semibold">{selectedAlert.enrichment?.virustotal?.engine_analysis?.Kaspersky}</span>
                          </div>
                        </div>
                      </div>

                      {/* Playbook Automation actions */}
                      <div className="flex gap-3">
                        <button 
                          onClick={() => generatePlaybookDossier(selectedAlert)}
                          disabled={aiReportLoading}
                          className="flex-1 py-3 btn-obsidian-hologram rounded-xl disabled:opacity-50 cursor-pointer"
                        >
                          {aiReportLoading ? 'Compiling AI Response...' : 'Request AI Response Dossier'}
                        </button>
                        <button 
                          onClick={() => dispatchSoarWebhook(selectedAlert)}
                          disabled={isDispatching}
                          className="flex-1 py-3 btn-obsidian-hologram rounded-xl disabled:opacity-50 cursor-pointer"
                        >
                          {isDispatching ? 'Dispatching Playbook...' : 'Trigger SOAR Webhook'}
                        </button>
                      </div>

                      {/* Webhook Response */}
                      {n8nDispatchResult && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl font-mono text-[11px] leading-relaxed text-emerald-400">
                          <p className="font-bold">[SUCCESS] n8n Webhook Status: {n8nDispatchResult.n8n_status.toUpperCase()}</p>
                          <p className="mt-1">Incident routed to Slack ({n8nDispatchResult.routing_simulation?.slack_channel}) and responders.</p>
                          <p className="text-[9px] text-txt-faint mt-1">Workflow ID: {n8nDispatchResult.routing_simulation?.workflow_execution_id}</p>
                        </div>
                      )}

                      {/* AI Markdown report summary */}
                      {aiReportDossier && (
                        <div className="border border-white/10 bg-black/20 rounded-xl p-5 prose-report">
                          <ReactMarkdown
                            components={{
                              h1: ({children}) => <h3 className="text-sm font-bold text-white uppercase tracking-widest mt-0 mb-4 pb-2 border-b border-white/10">{children}</h3>,
                              h2: ({children}) => <h4 className="text-xs font-bold text-sky uppercase tracking-wider mt-5 mb-2">{children}</h4>,
                              p: ({children}) => <p className="text-xs text-txt-dim leading-relaxed mb-3">{children}</p>,
                              ul: ({children}) => <ul className="space-y-1.5 mb-4 pl-0">{children}</ul>,
                              li: ({children}) => (
                                <li className="flex items-start gap-2 text-xs text-txt-dim">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky/60 shrink-0" />
                                  <span className="leading-relaxed">{children}</span>
                                </li>
                              ),
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                            }}
                          >
                            {aiReportDossier}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass p-16 text-center text-txt-faint font-mono text-sm h-full flex flex-col justify-center items-center">
                      <Radio className="w-12 h-12 mb-4 opacity-30 animate-pulse text-sky" />
                      Select an incoming SOC stream incident to analyze threat vectors and run containment playbooks.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. OVERVIEW DASHBOARD */}
          {page === 'dashboard' && (!overview ? <Loader /> : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* LEFT SIDEBAR PANEL: Status Gauge & Incident Queue (lg:col-span-3) */}
              <div className="lg:col-span-3 col-span-12 glass bg-[#080a18]/70 border border-white/5 p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-sky/20 to-transparent"></div>
                
                {/* Section 1: Security Status */}
                <div>
                  <h3 className="text-xs font-semibold text-txt-dim mb-3 tracking-widest uppercase flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky animate-pulse"></span>
                    Security Status
                  </h3>
                  
                  {/* Gauge Dial SVG */}
                  <div className="flex justify-center items-center py-1 relative">
                    <svg viewBox="0 0 200 130" className="w-full max-w-[160px]">
                      <defs>
                        <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#fb7185" />
                        </linearGradient>
                        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </radialGradient>
                        <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2.5" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      
                      <circle cx="100" cy="90" r="50" fill="url(#center-glow)" />
                      <circle cx="100" cy="90" r="50" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="0.8" strokeDasharray="3, 4" />
                      <circle cx="100" cy="90" r="35" fill="none" stroke="rgba(56, 189, 248, 0.03)" strokeWidth="0.8" />
                      <circle cx="100" cy="90" r="20" fill="none" stroke="rgba(56, 189, 248, 0.02)" strokeWidth="0.8" />

                      <line
                        x1="100"
                        y1="90"
                        x2="100"
                        y2="15"
                        stroke="rgba(56, 189, 248, 0.18)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="-180 100 90"
                          to="0 100 90"
                          dur="5s"
                          repeatCount="indefinite"
                        />
                      </line>

                      <path
                        d="M 30 90 A 70 70 0 0 1 170 90"
                        fill="none"
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      
                      {Array.from({ length: 11 }).map((_, i) => {
                        const angle = -180 + i * 18;
                        const rad = (angle * Math.PI) / 180;
                        const r1 = 74;
                        const r2 = 79;
                        const tx1 = 100 + r1 * Math.cos(rad);
                        const ty1 = 90 + r1 * Math.sin(rad);
                        const tx2 = 100 + r2 * Math.cos(rad);
                        const ty2 = 90 + r2 * Math.sin(rad);
                        return (
                          <line
                            key={i}
                            x1={tx1}
                            y1={ty1}
                            x2={tx2}
                            y2={ty2}
                            stroke={i % 5 === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"}
                            strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
                          />
                        );
                      })}

                      <path
                        d="M 30 90 A 70 70 0 0 1 170 90"
                        fill="none"
                        stroke="url(#gauge-grad)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="219.9"
                        strokeDashoffset={219.9 - ((overview.threat_score || 65) / 100) * 219.9}
                        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                      />
                      
                      <line
                        x1="100"
                        y1="90"
                        x2="100"
                        y2="30"
                        stroke="#f8fafc"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        filter="url(#gauge-glow)"
                        style={{
                          transform: `rotate(${-90 + ((overview.threat_score || 65) / 100) * 180}deg)`,
                          transformOrigin: '100px 90px',
                          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                      />
                      
                      <circle cx="100" cy="90" r="6.5" fill="#f8fafc" />
                      <circle cx="100" cy="90" r="2.5" fill="#050510" />
                      
                      <text x="100" y="112" textAnchor="middle" fill="#f8fafc" className="font-mono text-2xl font-bold">
                        {overview.threat_score || 65}
                      </text>
                      <text x="100" y="122" textAnchor="middle" fill="#94a3b8" className="text-[8px] uppercase tracking-widest font-semibold font-mono">
                        Threat Index
                      </text>
                    </svg>
                  </div>

                  {/* Segmented Threat Level Bar */}
                  <div className="mt-2 px-1">
                    <div className="flex justify-between text-[8px] text-txt-dim uppercase tracking-wider mb-1 font-mono">
                      <span className={(overview.threat_score || 65) < 25 ? "text-mint font-bold" : ""}>Low</span>
                      <span className={(overview.threat_score || 65) >= 25 && (overview.threat_score || 65) < 50 ? "text-amber font-bold" : ""}>Medium</span>
                      <span className={(overview.threat_score || 65) >= 50 && (overview.threat_score || 65) < 75 ? "text-orange-500 font-bold" : ""}>High</span>
                      <span className={(overview.threat_score || 65) >= 75 ? "text-rose font-bold" : ""}>Critical</span>
                    </div>
                    <div className="h-1.5 w-full bg-[rgba(255,255,255,0.02)] rounded-full overflow-hidden flex p-[1px] gap-[2px] border border-white/5">
                      <div className={`h-full flex-1 rounded-l-full ${(overview.threat_score || 65) < 25 ? 'bg-mint shadow-[0_0_8px_#34d399]' : 'bg-mint/10'}`}></div>
                      <div className={`h-full flex-1 ${(overview.threat_score || 65) >= 25 && (overview.threat_score || 65) < 50 ? 'bg-amber shadow-[0_0_8px_#fbbf24]' : 'bg-amber/10'}`}></div>
                      <div className={`h-full flex-1 ${(overview.threat_score || 65) >= 50 && (overview.threat_score || 65) < 75 ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-orange-500/10'}`}></div>
                      <div className={`h-full flex-1 rounded-r-full ${(overview.threat_score || 65) >= 75 ? 'bg-rose shadow-[0_0_8px_#fb7185]' : 'bg-rose/10'}`}></div>
                    </div>
                  </div>

                  {/* Status Metrics Under Gauge */}
                  <div className="grid grid-cols-3 gap-1 pt-4 border-t border-glass-border mt-3 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-txt-dim uppercase tracking-wider font-mono">Active</div>
                      <div className="font-mono font-bold text-sm text-amber mt-0.5">
                        {overview.threat_metrics?.active_threats || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-txt-dim uppercase tracking-wider font-mono">Vulns</div>
                      <div className="font-mono font-bold text-sm text-rose mt-0.5">
                        {overview.threat_metrics?.critical_vulns || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-txt-dim uppercase tracking-wider font-mono">Trend</div>
                      <div className={`font-mono font-bold text-sm mt-0.5 ${(overview.threat_metrics?.trend_24h || 0) >= 0 ? 'text-rose' : 'text-mint'}`}>
                        {(overview.threat_metrics?.trend_24h || 0) >= 0 ? `+${overview.threat_metrics?.trend_24h}%` : `${overview.threat_metrics?.trend_24h}%`}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-glass-border/30 my-4"></div>

                {/* Section 2: Incident Workflow */}
                <div className="flex-1 flex flex-col justify-between min-h-[200px]">
                  <div>
                    <h3 className="text-xs font-semibold text-txt-dim mb-3 tracking-widest uppercase flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"></span>
                      Incident Workflow
                    </h3>
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {(overview.incidents || []).map((inc, i) => {
                        const statusColors = {
                          "Active": "border-l-4 border-rose bg-rose/5",
                          "Investigating": "border-l-4 border-amber bg-amber/5",
                          "Resolved": "border-l-4 border-mint bg-mint/5"
                        };
                        const badgeColors = {
                          "Active": "bg-rose/10 text-rose border-rose/20",
                          "Investigating": "bg-amber/10 text-amber border-amber/20",
                          "Resolved": "bg-mint/10 text-mint border-mint/20"
                        };
                        return (
                          <div key={inc.id || i} className={`p-2.5 rounded-lg border border-white/5 flex flex-col gap-1.5 transition-all duration-200 hover:translate-x-1 hover:bg-white/[0.04] hover:shadow-[0_0_12px_rgba(255,255,255,0.02)] ${statusColors[inc.status] || 'border-l-4 border-slate-500 bg-slate-500/5'}`}>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-txt flex items-center gap-1 truncate">
                                {inc.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-rose animate-ping shrink-0"></span>}
                                {inc.status === 'Investigating' && <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse shrink-0"></span>}
                                {inc.status === 'Resolved' && <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0"></span>}
                                <span className="truncate">{inc.title}</span>
                              </span>
                              <span className={`text-[7px] font-bold px-1 py-0.5 rounded border uppercase font-mono shrink-0 ${badgeColors[inc.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                {inc.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[8px] text-txt-dim font-mono">
                              <span>Ops: {inc.assigned_to}</span>
                              <span>{inc.time}</span>
                            </div>
                          </div>
                        );
                      })}
                      {(!overview.incidents || overview.incidents.length === 0) && (
                        <div className="text-txt-faint text-xs text-center py-8">No active incidents in queue</div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-glass-border/30 pt-3 mt-3 flex justify-between items-center text-[9px] text-txt-dim">
                    <span className="font-mono">Active Queue</span>
                    <span className="font-mono text-txt font-semibold">{(overview.incidents || []).filter(i => i.status !== 'Resolved').length} alerts</span>
                  </div>
                </div>

              </div>

              {/* RIGHT MAIN PANEL: Map & Analytics (lg:col-span-9) */}
              <div className="lg:col-span-9 col-span-12 flex flex-col gap-6">
                
                {/* Live Threat Map */}
                <div className="glass p-5 flex flex-col justify-between min-h-[350px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-rose/20 to-transparent"></div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-txt-dim tracking-wider uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse"></span>
                      Live Threat Map
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-rose animate-ping"></span>
                      <span className="text-txt-dim font-mono">SOC Real-Time Stream</span>
                    </div>
                  </div>

                  {/* World Map & Feed Container */}
                  <div className="flex-1 bg-[rgba(5,5,20,0.45)] border border-[rgba(255,255,255,0.03)] rounded-lg overflow-hidden flex flex-col lg:flex-row items-stretch min-h-[240px]">
                    
                    {/* SVG Map Area (flex-1) */}
                    <div className="flex-1 flex justify-center items-center relative min-h-[200px] p-2">
                      {mapPaths.length === 0 ? (
                        <div className="text-txt-faint font-mono text-xs animate-pulse">Initializing global vector projection...</div>
                      ) : (
                        <svg viewBox="30.767 241.591 784.077 458.627" className="w-full h-full max-h-[320px] p-2">
                          {/* Geographic Latitude/Longitude Gridlines */}
                          <g stroke="rgba(255, 255, 255, 0.02)" strokeWidth="0.5" strokeDasharray="3, 6">
                            {[-40, -20, 0, 20, 40].map(lat => (
                              <line key={`lat-${lat}`} x1="30.767" y1={getY(lat)} x2="814.844" y2={getY(lat)} />
                            ))}
                            {[-120, -60, 0, 60, 120].map(lon => (
                              <line key={`lon-${lon}`} x1={getX(lon)} y1="241.591" x2={getX(lon)} y2="700.218" />
                            ))}
                          </g>

                          {/* Central Target Crosshair */}
                          {(() => {
                            const cx = getX(0);
                            const cy = getY(0);
                            return (
                              <g stroke="rgba(56, 189, 248, 0.1)" strokeWidth="0.8">
                                <circle cx={cx} cy={cy} r="18" fill="none" strokeDasharray="2, 4" />
                                <line x1={cx - 25} y1={cy} x2={cx + 25} y2={cy} />
                                <line x1={cx} y1={cy - 25} x2={cx} y2={cy + 25} />
                              </g>
                            );
                          })()}

                          {/* Map Landmass Outlines */}
                          <g fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.5">
                            {mapPaths.map(p => (
                              <path key={p.id} d={p.d} id={`map-country-${p.id}`} className="hover:fill-[rgba(255,255,255,0.06)] transition-colors" />
                            ))}
                          </g>

                          {/* Map Arcs & Points */}
                          {mapArcs.map((arc, idx) => {
                            const x1 = getX(arc.origin.lon);
                            const y1 = getY(arc.origin.lat);
                            const x2 = getX(arc.target.lon);
                            const y2 = getY(arc.target.lat);
                            
                            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return null;

                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2;
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            const ctrlX = midX;
                            
                            const curveVariance = 0.14 + (idx % 4) * 0.06;
                            const ctrlY = midY - dist * curveVariance;

                            const motionId = `motion-${arc.id}`;

                            return (
                              <g key={arc.id}>
                                {/* Static & Pulsing Attacker Origin Pin */}
                                <circle cx={x1} cy={y1} r="2.5" fill="#fb7185" />
                                <circle cx={x1} cy={y1} r="2.5" fill="none" stroke="#fb7185" strokeWidth="1">
                                  <animate attributeName="r" from="2.5" to="10" dur="1.8s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" from="1" to="0" dur="1.8s" repeatCount="indefinite" />
                                </circle>

                                {/* Static & Pulsing Corporate Target Pin */}
                                <circle cx={x2} cy={y2} r="3" fill="#38bdf8" />
                                <circle cx={x2} cy={y2} r="3" fill="none" stroke="#38bdf8" strokeWidth="1.5">
                                  <animate attributeName="r" from="3" to="8" dur="2s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
                                </circle>

                                {/* Background arc curve */}
                                <path
                                  d={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
                                  fill="none"
                                  stroke="rgba(56, 189, 248, 0.08)"
                                  strokeWidth="1"
                                />

                                {/* Animated dash flow */}
                                <path
                                  id={motionId}
                                  d={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
                                  fill="none"
                                  stroke={arc.severity >= 8 ? "rgba(251, 113, 133, 0.4)" : "rgba(56, 189, 248, 0.4)"}
                                  strokeWidth="1.5"
                                  strokeDasharray="6, 18"
                                >
                                  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2.5s" repeatCount="indefinite" />
                                </path>

                                {/* Animated Packet Traveler Dot traveling along path */}
                                <circle r="2" fill={arc.severity >= 8 ? "#fb7185" : "#38bdf8"}>
                                  <animateMotion
                                    dur="2.5s"
                                    repeatCount="indefinite"
                                    path={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
                                  />
                                </circle>
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>

                    {/* Tactical Attack Stream Sidebar Feed (lg:w-[280px]) */}
                    <div className="w-full lg:w-[280px] border-t lg:border-t-0 lg:border-l border-glass-border/30 bg-[rgba(5,5,15,0.4)] p-4 font-mono text-[9px] flex flex-col justify-between text-left">
                      <div>
                        <div className="text-[10px] font-bold text-sky mb-2 border-b border-glass-border pb-1.5 flex justify-between">
                          <span>TACTICAL ATTACK STREAM</span>
                          <span className="animate-pulse text-rose font-bold">● LIVE</span>
                        </div>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {liveIncidents.slice(0, 5).map((inc, i) => {
                            const alertColor = inc.severity >= 8 ? 'text-rose' : (inc.severity >= 5 ? 'text-amber' : 'text-sky');
                            return (
                              <div key={inc.id || i} className="text-txt-dim flex items-start gap-1 leading-normal border-b border-white/[0.02] pb-1.5 font-mono">
                                <span className={`${alertColor} shrink-0 font-bold`}>⚡</span>
                                <div className="truncate">
                                  <span className={`text-txt font-semibold ${alertColor}`}>{inc.attack_type}</span> from <span className="text-txt font-semibold">{inc.origin_city || inc.region}</span> to <span className="text-sky font-semibold">{inc.target_city || "Bangalore HQ"}</span>
                                  <div className="text-[7px] text-txt-faint mt-0.5">{inc.id} • {inc.timestamp}</div>
                                </div>
                              </div>
                            );
                          })}
                          {liveIncidents.length === 0 && (
                            <div className="text-txt-faint animate-pulse py-2 text-center">Awaiting incoming telemetry streams...</div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Map Telemetry Stats Row */}
                  <div className="grid grid-cols-3 gap-2 border-t border-glass-border pt-4 mt-3 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-txt-dim block uppercase tracking-wider font-mono">Top Origin</span>
                      <span className="font-bold text-txt text-rose mt-0.5 block truncate">{overview.map_stats?.top_origin || "Moscow, RU"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-dim block uppercase tracking-wider font-mono">Top Target</span>
                      <span className="font-bold text-txt text-sky mt-0.5 block truncate">{overview.map_stats?.top_target || "Bangalore HQ"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-dim block uppercase tracking-wider font-mono">Event Rate</span>
                      <span className="font-bold font-mono text-txt text-mint mt-0.5 block truncate">{overview.map_stats?.active_rate || "1.24"} ev/s</span>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ROW: Network Throughput & Endpoint Health (lg:col-span-12) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  
                  {/* Network Throughput Area Chart (lg:col-span-8) */}
                  <div className="lg:col-span-8 col-span-12 glass p-5 flex flex-col justify-between min-h-[290px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-mint/20 to-transparent"></div>
                    <div>
                      <h3 className="text-sm font-semibold text-txt-dim mb-3 tracking-wider uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse"></span>
                        Network Throughput
                      </h3>
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={overview.traffic?.data || []}>
                            <defs>
                              <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.18}/>
                                <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                            <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={TT} />
                            <Area type="monotone" dataKey="throughput" name="Throughput (Gb/s)" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorThroughput)" />
                            <Area type="monotone" dataKey="blocked" name="Blocked Attacks" stroke="#fb7185" strokeWidth={1} fillOpacity={1} fill="url(#colorBlocked)" />
                            
                            {overview.traffic?.data && overview.traffic.data[8] && (
                              <ReferenceDot
                                x={overview.traffic.data[8].time}
                                y={overview.traffic.data[8].throughput}
                                r={5.5}
                                fill="#fb7185"
                                stroke="#050510"
                                strokeWidth={2}
                                className="animate-ping"
                              />
                            )}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-glass-border pt-3 mt-3 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-txt-dim block uppercase tracking-wider font-mono">Avg Traffic</span>
                        <span className="font-bold font-mono text-txt text-sky mt-0.5 block">{overview.traffic?.avg_throughput || 0} Gb/s</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-txt-dim block uppercase tracking-wider font-mono">Blocked IPs</span>
                        <span className="font-bold font-mono text-txt text-rose mt-0.5 block">{overview.traffic?.total_blocked || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Endpoint Health Donut Chart (lg:col-span-4) */}
                  <div className="lg:col-span-4 col-span-12 glass p-5 flex flex-col justify-between min-h-[290px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-lavender/20 to-transparent"></div>
                    <div>
                      <h3 className="text-sm font-semibold text-txt-dim mb-3 tracking-wider uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-lavender animate-pulse"></span>
                        Endpoint Health
                      </h3>
                      <div className="h-[150px] flex justify-center items-center relative">
                        
                        {/* Holographic scanner rings */}
                        <div className="absolute w-[122px] h-[122px] rounded-full border border-sky/15 border-dashed animate-spin-slow pointer-events-none" style={{ animationDuration: '25s' }}></div>
                        <div className="absolute w-[132px] h-[132px] rounded-full border border-lavender/10 border-dashed animate-spin-slow pointer-events-none" style={{ animationDuration: '45s', animationDirection: 'reverse' }}></div>

                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Secure', value: overview.endpoints?.secure || 280, color: '#34d399' },
                                { name: 'Warning', value: overview.endpoints?.warning || 40, color: '#fbbf24' },
                                { name: 'Compromised', value: overview.endpoints?.compromised || 20, color: '#fb7185' }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={58}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {[
                                { name: 'Secure', value: overview.endpoints?.secure || 280, color: '#34d399' },
                                { name: 'Warning', value: overview.endpoints?.warning || 40, color: '#fbbf24' },
                                { name: 'Compromised', value: overview.endpoints?.compromised || 20, color: '#fb7185' }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-lg font-bold font-mono text-white">
                            {((overview.endpoints?.secure || 280) / ((overview.endpoints?.secure || 280) + (overview.endpoints?.warning || 40) + (overview.endpoints?.compromised || 20)) * 100).toFixed(0)}%
                          </span>
                          <span className="text-[7px] uppercase tracking-widest text-txt-dim font-semibold font-mono">Secure</span>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="border-t border-glass-border pt-3 mt-3 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-mint"></span>
                          <span className="text-txt-dim text-[10px] font-mono">Secure</span>
                        </div>
                        <span className="font-mono font-bold text-txt text-[10px]">{overview.endpoints?.secure || 280}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber"></span>
                          <span className="text-txt-dim text-[10px] font-mono">Warning</span>
                        </div>
                        <span className="font-mono font-bold text-txt text-[10px]">{overview.endpoints?.warning || 40}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose"></span>
                          <span className="text-txt-dim text-[10px] font-mono">Compromised</span>
                        </div>
                        <span className="font-mono font-bold text-txt text-[10px]">{overview.endpoints?.compromised || 20}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          ))}{/* 3. CLIENT MANAGEMENT & SCANS */}
          {page === 'clients' && !scanWizard && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Client Engagements</h2>
                  <p className="text-xs text-txt-faint mt-1">Manage network security clients and launch custom vulnerability audits</p>
                </div>
                <button onClick={() => setNewClientModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-lavender/80 to-sky/80 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:brightness-110 transition cursor-pointer">
                  <Plus className="w-4 h-4" /> New Client
                </button>
              </div>

              {!clients ? <Loader /> : clients.length === 0 ? (
                <div className="glass p-16 text-center">
                  <Shield className="w-12 h-12 text-lavender/40 mx-auto mb-4" />
                  <p className="text-txt-dim text-sm">No clients yet. Create your first client to begin scanning target networks.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-5">
                  {clients.map(c => (
                    <div key={c.id} className="glass-strong p-6 group hover:border-lavender/30 transition duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lavender/30 to-sky/30 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-lavender" />
                        </div>
                        <button onClick={() => deleteClient(c.id)} className="opacity-0 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-rose/10 text-rose cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="text-base font-semibold text-white mb-1">{c.name}</h3>
                      <p className="text-xs text-txt-faint mb-4 line-clamp-2">{c.description || 'No description'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-txt-faint">{c.scan_count} scan{c.scan_count !== 1 ? 's' : ''}</span>
                        <button onClick={() => { setScanWizard({ step: 'target', clientId: c.id, clientName: c.name }); setScanTarget(''); }}
                          className="flex items-center gap-1.5 bg-lavender/20 text-lavender text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-lavender/30 transition cursor-pointer">
                          <Search className="w-3 h-3" /> New Scan <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New Client Modal */}
              {newClientModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="glass-strong p-8 w-full max-w-md mx-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-semibold">New Client</h3>
                      <button onClick={() => setNewClientModal(false)} className="p-1 rounded-lg hover:bg-white/5 cursor-pointer"><X className="w-4 h-4 text-txt-faint" /></button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-txt-faint mb-1.5 block font-medium">Client / Company Name *</label>
                        <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="e.g. Acme Corp" className="w-full glass-input rounded-xl px-4 py-3 text-sm text-txt placeholder-txt-faint" />
                      </div>
                      <div>
                        <label className="text-xs text-txt-faint mb-1.5 block font-medium">Engagement Notes</label>
                        <textarea value={newClientDesc} onChange={e => setNewClientDesc(e.target.value)} placeholder="e.g. Internal subnet audit" rows={3} className="w-full glass-input rounded-xl px-4 py-3 text-sm text-txt placeholder-txt-faint resize-none" />
                      </div>
                      <button onClick={createClient} disabled={!newClientName.trim()} className="w-full bg-gradient-to-r from-lavender/80 to-sky/80 text-white text-sm font-medium py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50 cursor-pointer">
                        Create Client
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCAN WIZARD — Target */}
          {page === 'clients' && scanWizard?.step === 'target' && (
            <div className="max-w-2xl mx-auto pt-8">
              <button onClick={() => setScanWizard(null)} className="flex items-center gap-2 text-xs text-txt-faint hover:text-txt mb-6 transition cursor-pointer">
                ← Back to Clients
              </button>
              <div className="glass-strong p-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lavender/30 to-sky/30 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-lavender" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">New Engagement Scan</h3>
                    <p className="text-xs text-txt-faint">Client: <span className="text-lavender">{scanWizard.clientName}</span></p>
                  </div>
                </div>
                <div className="border-t border-white/10 my-6" />
                <label className="text-xs text-txt-faint font-medium block mb-2">Scan Target IP or Subnet</label>
                <p className="text-[11px] text-txt-faint mb-4">Enter a host IP address, hostname, domain, or CIDR network block</p>
                
                <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] text-txt-faint font-mono">
                  {['192.168.1.1', '192.168.1.0/24', 'localhost', 'google.com'].map(ex => (
                    <button key={ex} onClick={() => setScanTarget(ex)} className="glass px-3 py-2 rounded-lg text-left hover:bg-white/5 transition font-mono cursor-pointer">{ex}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <input value={scanTarget} onChange={e => setScanTarget(e.target.value)} placeholder="e.g. 192.168.1.0/24" className="w-full glass-input rounded-xl px-5 py-3.5 text-sm text-txt placeholder-txt-faint" />
                  <button onClick={() => axios.get(`${API}/local-ip`, getHeaders()).then(r => setScanTarget(r.data.ip + '/24'))} className="shrink-0 bg-white/5 border border-white/10 hover:bg-white/10 text-txt-dim text-xs font-medium px-4 py-3.5 rounded-xl transition cursor-pointer">
                    Get Local Subnet
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-amber/5 border border-amber/20 rounded-xl p-3 mb-6">
                  <Shield className="w-4 h-4 text-amber shrink-0" />
                  <p className="text-[11px] text-amber">Active Scanning performs port audits and banner grabbing against 55 common services. Subnet sweeps can take up to 2-3 minutes. Ensure you have authorized permission.</p>
                </div>
                <button onClick={() => launchScan(scanWizard.clientId)} disabled={!scanTarget.trim()}
                  className="w-full bg-gradient-to-r from-lavender/80 to-sky/80 text-white text-sm font-semibold py-3.5 rounded-xl hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                  <Search className="w-4 h-4" /> Launch Scan
                </button>
              </div>
            </div>
          )}

          {/* SCAN WIZARD — Progress */}
          {page === 'clients' && scanWizard?.step === 'progress' && (
            <div className="max-w-2xl mx-auto pt-8">
              <div className="glass-strong p-10 text-center">
                {activeScan?.status === 'failed' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-rose/10 flex items-center justify-center mx-auto mb-6 border border-rose/30">
                      <X className="w-7 h-7 text-rose" />
                    </div>
                    <h3 className="text-lg font-semibold text-rose mb-2">Scan Failed</h3>
                    <p className="text-sm text-txt-faint mb-4">Target: <span className="text-sky font-mono">{scanTarget}</span></p>
                    {activeScan.ai_summary && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl font-mono text-xs mb-6 max-w-md mx-auto leading-relaxed">
                        {activeScan.ai_summary}
                      </div>
                    )}
                    <button onClick={() => setScanWizard(null)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition cursor-pointer text-xs uppercase tracking-wider font-mono">
                      Back to Clients
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lavender/30 to-sky/30 flex items-center justify-center mx-auto mb-6">
                      <RefreshCw className="w-7 h-7 text-lavender animate-spin" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Active Scanning in Progress</h3>
                    <p className="text-sm text-txt-faint mb-2">Target: <span className="text-sky font-mono">{scanTarget}</span></p>
                    <p className="text-xs text-txt-faint mb-8">Status: <span className="text-mint font-medium capitalize font-mono">{activeScan?.status || 'pending'}</span></p>
                    <div className="w-full bg-white/5 rounded-full h-1.5 mb-8">
                      <div className="bg-gradient-to-r from-lavender to-sky h-1.5 rounded-full animate-pulse" style={{width: activeScan?.status === 'running' ? '65%' : '15%'}} />
                    </div>
                    <p className="text-[11px] text-txt-faint font-mono">Dispatched sweeps → Mapping host nodes → Fingerprinting banners → Correlating CVE exploits...</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SCAN WIZARD — Finished scan report viewer */}
          {page === 'clients' && scanWizard?.step === 'report' && scanReport && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <button onClick={() => { setScanWizard(null); setScanReport(null); }} className="flex items-center gap-2 text-xs text-txt-faint hover:text-txt mb-2 transition cursor-pointer">← Back to Clients</button>
                  <h2 className="text-xl font-bold text-white">Scan Vulnerability Audit</h2>
                  <p className="text-xs text-txt-faint mt-1">Target: <span className="font-mono text-sky">{scanReport.target}</span> · {scanReport.hosts?.length} host(s) discovered</p>
                </div>
                <a href={`${API}/scans/${scanReport.id}/report`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-r from-lavender/80 to-sky/80 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:brightness-110 transition border border-white/10 shadow-md">
                  <Download className="w-4 h-4" /> Download PDF Report
                </a>
              </div>

              {/* AI summary breakdown */}
              {scanReport.ai_summary && (
                <div className="glass-strong overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-lavender/10 to-sky/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lavender/40 to-sky/40 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-widest">AI Analyst Risk Assessment</p>
                      <p className="text-[10px] text-txt-faint">Security Report Summary · Powered by pluggable LLM API</p>
                    </div>
                  </div>
                  <div className="px-8 py-6 prose-report">
                    <ReactMarkdown
                      components={{
                        h2: ({children}) => (
                          <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
                            <div className="w-1 h-4 bg-gradient-to-b from-lavender to-sky rounded-full" />
                            <h2 className="text-xs font-bold text-white uppercase tracking-widest m-0">{children}</h2>
                          </div>
                        ),
                        p: ({children}) => <p className="text-sm text-txt-dim leading-relaxed mb-3">{children}</p>,
                        ul: ({children}) => <ul className="space-y-2 mb-4 pl-0">{children}</ul>,
                        ol: ({children}) => <ol className="space-y-2 mb-4 pl-0 list-none">{children}</ol>,
                        li: ({children}) => (
                          <li className="flex items-start gap-2 text-sm text-txt-dim">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-lavender/60 shrink-0" />
                            <span className="leading-relaxed">{children}</span>
                          </li>
                        ),
                        strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                        code: ({children}) => <code className="px-1.5 py-0.5 rounded bg-white/5 text-sky text-xs font-mono">{children}</code>,
                      }}
                    >
                      {scanReport.ai_summary}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Host list */}
              {scanReport.hosts?.length === 0 ? (
                <div className="glass p-12 text-center">
                  <p className="text-txt-dim text-sm">No live hosts detected on subnet range: <span className="font-mono text-sky">{scanReport.target}</span></p>
                </div>
              ) : (
                scanReport.hosts?.map((host, hi) => (
                  <div key={hi} className="glass-strong overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-sky" />
                        <div>
                          <p className="text-sm font-semibold text-white font-mono">{host.ip}</p>
                          <p className="text-[11px] text-txt-faint">{host.hostname || 'No hostname'} · OS: {host.os_guess}</p>
                        </div>
                      </div>
                      <span className="text-xs text-txt-faint font-mono">{host.ports?.length} open ports</span>
                    </div>
                    {host.ports?.length === 0 ? (
                      <div className="p-6"><p className="text-xs text-mint">No vulnerability findings detected.</p></div>
                    ) : (
                      <table className="w-full text-left">
                        <thead><tr className="border-b border-white/5">{['Port', 'Service', 'Banner', 'Exploit CVE', 'Severity'].map(h => <th key={h} className="px-5 py-3 text-[10px] font-bold text-txt-faint uppercase tracking-widest">{h}</th>)}</tr></thead>
                        <tbody>
                          {host.ports.map((p, pi) => (
                            <tr key={pi} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                              <td className="px-5 py-3 font-mono text-sky text-xs font-bold">{p.port}</td>
                              <td className="px-5 py-3 text-sm text-white">{p.service}</td>
                              <td className="px-5 py-3 text-xs text-txt-faint font-mono max-w-[180px] truncate">{p.banner || '—'}</td>
                              <td className="px-5 py-3 text-xs text-txt-dim font-mono">{p.cve || '—'}</td>
                              <td className="px-5 py-3"><Pill s={p.severity} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. SYSTEM HEALTH POSTURE AUDITING */}
          {page === 'system' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Local Posture Diagnostics</h2>
                  <p className="text-xs text-txt-faint mt-1">Audit security settings on this local computer</p>
                </div>
                <button onClick={() => {
                  setIsSysScanning(true);
                  axios.post(`${API}/system-scan`, {}, getHeaders()).then(r => { setSysHealth(r.data); setIsSysScanning(false); }).catch(() => setIsSysScanning(false));
                }} disabled={isSysScanning} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:brightness-110 transition disabled:opacity-50 cursor-pointer">
                  {isSysScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} {isSysScanning ? 'Running...' : 'Run Diagnostics'}
                </button>
              </div>

              {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex gap-4 items-start shadow-md mb-6">
                  <Shield className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber uppercase tracking-wider font-mono">Cloud Deployment Mode</h4>
                    <p className="text-xs text-txt-dim mt-1 leading-relaxed">
                      You are accessing the platform via a cloud deployment. The diagnostics below are auditing the security posture of the <strong>remote cloud server</strong> (Render Linux Container), not your local computer.
                    </p>
                    <p className="text-[11px] text-txt-faint mt-2">
                      To scan your local Windows machine's active firewall and Windows Defender status, please run the application locally using the <code className="px-1.5 py-0.5 rounded bg-white/5 text-sky font-mono text-[10px]">./start.bat</code> launcher and navigate to <code className="px-1.5 py-0.5 rounded bg-white/5 text-sky font-mono text-[10px]">http://127.0.0.1:5173</code>.
                    </p>
                  </div>
                </div>
              )}

              {!sysHealth && !isSysScanning && (
                <div className="glass p-16 text-center">
                  <Activity className="w-12 h-12 text-teal-500/40 mx-auto mb-4 animate-pulse" />
                  <p className="text-txt-dim text-sm">Launch local auditing dashboard to monitor Windows Defender and firewall policies.</p>
                </div>
              )}
              
              {isSysScanning && <Loader />}

              {sysHealth && !isSysScanning && (
                <>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="glass-strong p-6 border-t-2" style={{borderColor: sysHealth.firewall.secure ? '#10b981' : '#f43f5e'}}>
                      <h3 className="text-sm font-medium text-txt-faint mb-4 uppercase tracking-wider font-mono">Windows Firewall</h3>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${sysHealth.firewall.secure ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={`text-xl font-bold ${sysHealth.firewall.secure ? 'text-emerald-500' : 'text-rose-500'}`}>{sysHealth.firewall.status.toUpperCase()}</p>
                          <p className="text-[11px] text-txt-dim">Firewall Shield</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-strong p-6 border-t-2" style={{borderColor: sysHealth.defender.secure ? '#10b981' : '#f43f5e'}}>
                      <h3 className="text-sm font-medium text-txt-faint mb-4 uppercase tracking-wider font-mono">Windows Defender</h3>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${sysHealth.defender.secure ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                          <Activity className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={`text-xl font-bold ${sysHealth.defender.secure ? 'text-emerald-500' : 'text-rose-500'}`}>{sysHealth.defender.status.toUpperCase()}</p>
                          <p className="text-[11px] text-txt-dim">Real-Time Protection</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-strong p-6 border-t-2 border-sky-500">
                      <h3 className="text-sm font-medium text-txt-faint mb-4 uppercase tracking-wider font-mono">Established Links</h3>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center">
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-sky-500">{sysHealth.network.established_connections}</p>
                          <p className="text-[11px] text-txt-dim">Established TCP</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {sysHealth.ai_summary && (
                    <div className="glass-strong overflow-hidden mt-6">
                      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-teal-500/10 to-emerald-500/5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/40 to-emerald-500/40 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-widest">AI Security Posture Diagnosis</p>
                          <p className="text-[10px] text-txt-faint">Windows posturing advisory</p>
                        </div>
                      </div>
                      <div className="px-8 py-6 prose-report">
                        <ReactMarkdown
                          components={{
                            h2: ({children}) => (
                              <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
                                <div className="w-1 h-4 bg-gradient-to-b from-teal-500 to-emerald-500 rounded-full" />
                                <h2 className="text-xs font-bold text-white uppercase tracking-widest m-0">{children}</h2>
                              </div>
                            ),
                            p: ({children}) => <p className="text-sm text-txt-dim leading-relaxed mb-3">{children}</p>,
                            ul: ({children}) => <ul className="space-y-2 mb-4 pl-0">{children}</ul>,
                            li: ({children}) => (
                              <li className="flex items-start gap-2 text-sm text-txt-dim">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500/60 shrink-0" />
                                <span className="leading-relaxed">{children}</span>
                              </li>
                            ),
                            strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                          }}
                        >
                          {sysHealth.ai_summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 5. STREAMING AI ANALYST CHAT */}
          {page === 'ai' && (
            <div className="max-w-4xl mx-auto h-[72vh] flex flex-col pt-2">
              <div className="glass-strong flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lavender/40 to-sky/40 flex items-center justify-center border border-white/10">
                    <MessageSquare className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">AI Security Analyst Chat</h3>
                    <p className="text-[11px] text-txt-faint">Interact with pluggable AI engines (Groq/Gemini/Claude)</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-lavender/25 text-white border border-lavender/30' : 'bg-white/5 text-txt-dim border border-white/10'}`}>
                        {msg.content.split('\n').map((line, j) => <p key={j} className="mb-2 last:mb-0">{line}</p>)}
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-txt-faint flex items-center gap-2">
                        <div className="w-2 h-2 bg-lavender rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-sky rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                        <div className="w-2 h-2 bg-mint rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-white/10 bg-black/20">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Ask about vulnerabilities, IP threats, or generate a response playbook..." 
                      className="flex-1 glass-input rounded-xl px-5 py-4 text-sm text-txt placeholder-txt-faint" 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && sendChat()} 
                    />
                    <button 
                      onClick={sendChat} 
                      disabled={isChatting || !chatInput.trim()} 
                      className="w-14 bg-gradient-to-r from-lavender/80 to-sky/80 flex items-center justify-center rounded-xl hover:brightness-110 transition disabled:opacity-50 cursor-pointer border border-white/10"
                    >
                      <Send className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. REGIONAL TREND FORECASTING */}
          {page === 'forecast' && (
            <div className="grid grid-cols-3 gap-8">
              <div className="glass p-7 h-fit">
                <h3 className="text-sm font-medium text-txt-dim mb-6">Forecasting Parameters</h3>
                <div className="space-y-4">
                  <Sel label="Target Region" value={fReq.region} onChange={v => setFReq({ ...fReq, region: v })} opts={['Global', 'India']} />
                  <Sel label="Forecast Year" value={fReq.year} onChange={v => setFReq({ ...fReq, year: parseInt(v) })} opts={[2026, 2027, 2028, 2029, 2030]} />
                  <Sel label="Target Month" value={fReq.month} onChange={v => setFReq({ ...fReq, month: v })} opts={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']} />
                  <button onClick={predict} className="w-full bg-gradient-to-r from-lavender/80 to-sky/80 text-white font-medium text-sm py-3 rounded-xl hover:brightness-110 transition mt-2 cursor-pointer border border-white/10">Generate AI Forecast</button>
                </div>
              </div>
              <div className="col-span-2 space-y-6">
                {forecastLoading ? (
                  <Loader />
                ) : forecast ? (
                  forecast.error ? (
                    <div className="glass p-8 text-center text-rose border-rose/25 bg-rose/10 font-mono text-xs rounded-2xl">
                      [ERROR] {forecast.error}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-6">
                        <Metric label="Predicted Attacks" value={forecast.predictedAttacks?.toLocaleString() || '0'} color="#a78bfa" />
                        <Metric label="Financial Risk" value={forecast.financialRisk || 'N/A'} color="#fb7185" />
                        <Metric label="Threat Score" value={`${forecast.threatScore || 0}/100`} color="#38bdf8" />
                      </div>
                      <div className="glass p-7">
                        <h3 className="text-sm font-medium text-txt-dim mb-4">Threat Level Gauge</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-lavender to-rose transition-all duration-700" style={{ width: `${forecast.threatScore || 0}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-lavender font-mono">{forecast.threatScore || 0}%</span>
                        </div>
                      </div>
                      {forecast.insights && (
                        <div className="glass p-7">
                          <h3 className="text-sm font-medium text-txt-dim mb-4">Regional Insights</h3>
                          <div className="grid grid-cols-3 gap-4 font-mono">
                            {[['Top Segment Target', forecast.insights.topSector, '#34d399'], ['Attack Vector Pattern', forecast.insights.topAttack, '#fbbf24'], ['Ingress Hotspot', forecast.insights.topRegion, '#fb7185']].map(([l, v, c]) => (
                              <div key={l} className="py-3 border-r border-white/5 last:border-0 pr-2">
                                <p className="text-[10px] text-txt-faint mb-1.5 uppercase font-bold tracking-wider">{l}</p>
                                <p className="text-sm font-semibold truncate" style={{ color: c }}>{v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="glass p-14 text-center text-txt-faint text-sm">Select region, year, and target month, and click Generate to see the regression model predictions.</div>
                )}
              </div>
            </div>
          )}

          {/* 7. ANALYTICS MAPS & DETAILS */}
          {page === 'network' && (!net || !india ? <Loader /> : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 py-2 px-1 font-mono text-xs">
                <div className="w-2 h-2 rounded-full bg-rose animate-pulse" />
                <span className="text-txt-faint font-bold">CRITICAL ACTIVE STATE DETECTED:</span>
                <span className="text-sm font-bold text-rose">{india.topState}</span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <GlassChart title="State-wise Hotspots">
                  <BarChart data={india.states} barCategoryGap="15%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="state" stroke="#475569" tick={{ fontSize: 8 }} interval={0} angle={-45} textAnchor="end" axisLine={false} tickLine={false} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(167,139,250,0.06)', radius: 6 }} />
                    <Bar dataKey="detections" fill="#a78bfa" radius={[6, 6, 0, 0]} name="Detections" />
                  </BarChart>
                </GlassChart>
                <GlassChart title="Ransomware Timeline">
                  <LineChart data={india.ransomware}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="Month" stroke="#475569" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="Detections" stroke="#fb7185" strokeWidth={2} dot={{ r: 3, fill: '#050510', stroke: '#fb7185', strokeWidth: 2 }} />
                  </LineChart>
                </GlassChart>
                <GlassChart title="Ingress Protocols">
                  <BarChart data={net.protocols} layout="vertical" margin={{ left: 15 }} barCategoryGap="25%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#475569" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.06)', radius: 6 }} />
                    <Bar dataKey="value" fill="#38bdf8" radius={[0, 6, 6, 0]} name="Count" />
                  </BarChart>
                </GlassChart>
                <GlassChart title="Incident Severity Distribution">
                  <BarChart data={net.severities} barCategoryGap="30%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(251,191,36,0.06)', radius: 6 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Count">
                      {net.severities.map((entry, idx) => {
                        const fills = ['#fb7185', '#fbbf24', '#34d399'];
                        return <Cell key={idx} fill={fills[idx % fills.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </GlassChart>
              </div>
            </div>
          ))}

          {/* 8. QUICK threat SCANNER */}
          {page === 'scanner' && (
            <div className="max-w-3xl mx-auto pt-8">
              <div className="glass-strong p-10">
                <h3 className="text-lg font-semibold mb-1">IP & Domain Threat Scanner</h3>
                <p className="text-xs text-txt-faint mb-8">Validate target IP/Domain reputation against OTX intelligence feeds and active CVE databases.</p>
                <div className="flex gap-3 mb-6">
                  <input type="text" placeholder="e.g. 8.8.8.8 or 192.168.1.1" className="flex-1 glass-input rounded-xl px-5 py-3.5 text-sm text-txt placeholder-txt-faint font-mono" value={ip} onChange={e => setIp(e.target.value)} />
                  <button onClick={scanIp} disabled={isScanning} className="bg-gradient-to-r from-lavender/80 to-sky/80 text-white font-medium text-sm px-8 py-3.5 rounded-xl hover:brightness-110 transition disabled:opacity-50 cursor-pointer border border-white/10 shadow-md">
                    {isScanning ? 'Auditing...' : 'Check Reputation'}
                  </button>
                </div>
                
                {ipRes?.error && <p className="text-sm text-rose mt-4 font-mono">{ipRes.message}</p>}
                
                {(ipRes || activeScanRes) && !ipRes?.error && (
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-white/80 border-b border-white/10 pb-2 uppercase tracking-widest font-mono">Intelligence Feeds</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {ipRes ? (
                        <>
                          <ScanResult label="Local Blacklist" threat={ipRes.localBlacklist} />
                          <ScanResult label="OTX Intelligence feeds" threat={ipRes.otxThreat} />
                        </>
                      ) : <Loader />}
                    </div>
                    
                    <h4 className="text-xs font-bold text-white/80 border-b border-white/10 pb-2 mt-8 uppercase tracking-widest font-mono">Active Port vulnerabilties</h4>
                    {isScanning && !activeScanRes ? <Loader /> : activeScanRes && (
                      <div className="glass p-6">
                        {activeScanRes.open_ports?.length > 0 ? (
                          <div className="space-y-4">
                            {activeScanRes.open_ports.map((p, i) => (
                              <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded bg-sky/20 text-sky text-xs font-bold font-mono">PORT {p.port}</span>
                                    <span className="text-sm font-medium">{p.service}</span>
                                  </div>
                                  <span className="text-xs text-mint font-bold">OPEN</span>
                                </div>
                                {p.vulnerabilities?.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                                    <p className="text-[10px] text-txt-faint uppercase font-bold tracking-wider font-mono">Vulnerabilities</p>
                                    {p.vulnerabilities.map((v, j) => (
                                      <div key={j} className="flex items-start gap-2 bg-rose/5 p-2.5 rounded-lg border border-rose/10 font-mono text-[11px]">
                                        <Pill s={v.severity} />
                                        <div>
                                          <p className="text-xs font-semibold text-rose">{v.cve}</p>
                                          <p className="text-[10px] text-txt-dim mt-0.5 leading-relaxed">{v.description}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-mint">No vulnerabilities detected.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 9. THREAT INTELLIGENCE DB TABLES */}
          {page === 'intelligence' && (!tables ? <Loader /> : (
            <div className="space-y-8">
              <div className="glass overflow-hidden">
                <div className="px-7 py-5 border-b border-white/5"><h3 className="text-sm font-medium text-txt-dim">Critical CVE exploits database</h3></div>
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['CVE ID', 'Severity Rating', 'Sector / Target'].map(h => <th key={h} className="px-7 py-3 text-[10px] font-semibold text-txt-faint uppercase tracking-widest">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tables.cves.map((c, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                        <td className="px-7 py-3.5 text-sm font-medium text-white">{c.cve || 'N/A'}</td>
                        <td className="px-7 py-3.5"><Pill s={c.severity} /></td>
                        <td className="px-7 py-3.5 text-sm text-txt-dim">{c.affected_sector || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="glass overflow-hidden">
                <div className="px-7 py-5 border-b border-white/5"><h3 className="text-sm font-medium text-txt-dim">Threat Actors Directory</h3></div>
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Group', 'Typology', 'Risk Level', 'Attacks'].map(h => <th key={h} className="px-7 py-3 text-[10px] font-semibold text-txt-faint uppercase tracking-widest">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tables.actors.map((a, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                        <td className="px-7 py-3.5 text-sm font-medium text-white">{a.group}</td>
                        <td className="px-7 py-3.5 text-sm text-txt-dim">{a.type}</td>
                        <td className="px-7 py-3.5"><Pill s={a.risk_level} /></td>
                        <td className="px-7 py-3.5 text-sm text-txt-dim">{a.attacks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

        </div>
      </main>
    </div>
  );
}

/* --- Helper layout views --- */
function Metric({ label, value, delta, color }) {
  return (
    <div className="py-1">
      <p className="text-[11px] text-txt-faint font-medium tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color }}>{value}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-[11px] mt-1 ${delta > 0 ? 'text-rose' : 'text-mint'}`}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs last year
        </p>
      )}
      <div className="metric-glow w-16" style={{ '--glow-color': color }} />
    </div>
  );
}

function Ring({ pct, color }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <svg width="66" height="66" viewBox="0 0 66 66">
      <circle cx="33" cy="33" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
      <circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 33 33)" className="severity-ring" style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
      <text x="33" y="36" textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="600">{pct}</text>
    </svg>
  );
}

function GlassChart({ title, children }) {
  return (
    <div className="glass p-7">
      <h3 className="text-sm font-medium text-txt-dim mb-5">{title}</h3>
      <div className="h-[270px]">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function ScanResult({ label, threat }) {
  return (
    <div className={`glass p-5 ${threat ? 'shadow-[inset_0_0_30px_rgba(251,113,133,0.05)] border-rose/20' : 'shadow-[inset_0_0_30px_rgba(52,211,153,0.05)] border-mint/20'}`}>
      <p className="text-[10px] text-txt-faint mb-1 font-mono uppercase">{label}</p>
      <p className={`text-xs font-bold ${threat ? 'text-rose' : 'text-mint'}`}>
        {threat ? 'Threat signature matched' : 'Clean / Safe'}
      </p>
    </div>
  );
}

function Sel({ label, value, onChange, opts }) {
  return (
    <div>
      <label className="block text-[11px] text-txt-faint mb-1.5 font-medium">{label}</label>
      <select className="w-full glass-input rounded-xl px-3 py-2.5 text-sm text-txt" value={value} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Pill({ s }) {
  const m = { critical: 'text-rose bg-rose/10', high: 'text-amber bg-amber/10', medium: 'text-sky bg-sky/10', low: 'text-mint bg-mint/10' };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${m[(s || '').toLowerCase()] || 'text-txt-faint bg-white/5'}`}>
      {s || 'N/A'}
    </span>
  );
}

function NavBtn({ icon: I, label }) { 
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-txt-dim hover:text-txt hover:bg-white/4 transition cursor-pointer">
      <I className="w-4 h-4" />{label}
    </button>
  ); 
}

function Loader() { 
  return <div className="text-center text-txt-faint text-xs font-mono py-20 animate-pulse">[PROCESSING] Loading data stream...</div>; 
}

export default App;

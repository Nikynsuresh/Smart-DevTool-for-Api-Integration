"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Compass, 
  Search, 
  AlertCircle, 
  Cpu, 
  Check, 
  Copy, 
  ArrowLeft
} from "lucide-react";
import { getIntegration, Integration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  path: string;
  method: string;
  description: string;
  parameters?: Parameter[];
  request_body_example?: string;
  response_body_example?: string;
}

export default function ExplorerPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("ALL");
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const data = await getIntegration(id);
        setIntegration(data);
        if (data.endpoints_json) {
          try {
            const parsedEndpoints = JSON.parse(data.endpoints_json);
            setEndpoints(parsedEndpoints);
            // Default select the first endpoint if available
            if (parsedEndpoints.length > 0) {
              setSelectedEndpoint(parsedEndpoints[0]);
            }
          } catch (e) {
            console.error("Failed to parse endpoints_json:", e);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load integration data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleCopy = (text: string, setCopied: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-[#07080b]">
        <Cpu className="h-8 w-8 text-indigo-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Assembling Endpoint Explorer assets...</span>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-[#07080b]">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <span className="text-sm text-slate-400 font-semibold">{error || "Integration not found."}</span>
        <Button onClick={() => router.push("/dashboard")} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // Detect Authentication Type from Integration auth_summary
  const detectAuthType = (authSummary: string | undefined): string => {
    if (!authSummary) return "API Key";
    const summaryLower = authSummary.toLowerCase();
    if (summaryLower.includes("bearer token") || summaryLower.includes("bearer")) {
      return "Bearer Token";
    }
    if (summaryLower.includes("oauth") || summaryLower.includes("oauth2")) {
      return "OAuth 2.0";
    }
    if (summaryLower.includes("basic auth") || summaryLower.includes("basic authentication")) {
      return "Basic Authentication";
    }
    if (summaryLower.includes("api key") || summaryLower.includes("apikey") || summaryLower.includes("api-key")) {
      return "API Key";
    }
    return "API Key";
  };

  const authType = detectAuthType(integration.auth_summary);

  // Generate required headers based on Authentication Type and method
  const getRequiredHeaders = (auth: string, method: string): Array<{ key: string; value: string; description: string }> => {
    const headers = [];
    if (auth === "Bearer Token") {
      headers.push({ key: "Authorization", value: "Bearer YOUR_TOKEN", description: "Standard OAuth2 Bearer token authentication header." });
    } else if (auth === "API Key") {
      headers.push({ key: "X-API-Key", value: "YOUR_API_KEY", description: "Custom API key authentication header." });
    } else if (auth === "Basic Authentication") {
      headers.push({ key: "Authorization", value: "Basic YOUR_BASE64_CREDENTIALS", description: "Username & password encoded in base64." });
    } else {
      headers.push({ key: "Authorization", value: "YOUR_API_KEY", description: "API Authorization header key." });
    }

    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      headers.push({ key: "Content-Type", value: "application/json", description: "Declares payload content type." });
    }

    return headers;
  };

  // Generate Curl Command dynamically
  const getSampleCurl = (integrationUrl: string, endpoint: Endpoint, auth: string): string => {
    const method = endpoint.method.toUpperCase();
    const cleanBase = integrationUrl.replace(/\/$/, "");
    const fullUrl = `${cleanBase}${endpoint.path}`;
    
    const lines = [`curl -X ${method} "${fullUrl}"`];
    
    const headers = getRequiredHeaders(auth, method);
    headers.forEach((h, idx) => {
      const isLast = idx === headers.length - 1 && !endpoint.request_body_example;
      lines.push(`  -H "${h.key}: ${h.value}"${isLast ? "" : " \\"}`);
    });
    
    if (endpoint.request_body_example) {
      const escapedBody = endpoint.request_body_example.replace(/'/g, "'\\''");
      lines.push(`  -d '${escapedBody}'`);
    }
    
    return lines.join("\n");
  };

  // Filter Logic
  const filteredEndpoints = endpoints.filter((ep) => {
    const methodMatch = selectedMethod === "ALL" || ep.method.toUpperCase() === selectedMethod;
    const query = searchQuery.toLowerCase();
    const textMatch = 
      ep.path.toLowerCase().includes(query) || 
      ep.method.toLowerCase().includes(query) || 
      ep.description.toLowerCase().includes(query);
    return methodMatch && textMatch;
  });

  const getMethodBadgeStyle = (method: string) => {
    const m = method.toUpperCase();
    if (m === "GET") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (m === "POST") return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    if (m === "PUT") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    if (m === "PATCH") return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    if (m === "DELETE") return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
  };

  // Stats Counters
  const totalCount = endpoints.length;
  const getCount = endpoints.filter(ep => ep.method.toUpperCase() === "GET").length;
  const postCount = endpoints.filter(ep => ep.method.toUpperCase() === "POST").length;
  const host = new URL(integration.url).hostname;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#07080b] overflow-hidden">
      {/* Header Panel */}
      <header className="border-b border-[#141520] bg-[#090a10] px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4.5 w-4.5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">{host}</h1>
            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              API Endpoint Explorer
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl mt-1">{integration.url}</p>
        </div>
        
        {/* Navigation Action */}
        <Button 
          onClick={() => router.push(`/code/${integration.id}`)}
          size="sm" 
          className="bg-[#10111a] hover:bg-[#181926] text-slate-300 hover:text-white border border-[#1f202e] rounded-xl text-[11px] font-semibold gap-1.5 h-9"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          View Code & Client
        </Button>
      </header>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-4 shrink-0 border-b border-[#141520] bg-[#08090f]/30">
        <Card className="bg-[#0b0c13] border-[#181926] rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Endpoints</span>
          <span className="text-xl font-bold text-white mt-1">{totalCount}</span>
        </Card>
        <Card className="bg-[#0b0c13] border-[#181926] rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">GET Endpoints</span>
          <span className="text-xl font-bold text-white mt-1">{getCount}</span>
        </Card>
        <Card className="bg-[#0b0c13] border-[#181926] rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">POST Endpoints</span>
          <span className="text-xl font-bold text-white mt-1">{postCount}</span>
        </Card>
        <Card className="bg-[#0b0c13] border-[#181926] rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Authentication</span>
          <span className="text-xs font-bold text-white mt-1 truncate">{authType}</span>
        </Card>
      </div>

      {/* Main split-pane content */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden h-0 min-h-0">
        {/* Left Column: Search, filter, and table list (60% width) */}
        <div className="col-span-12 lg:col-span-7 border-r border-[#141520] bg-[#08090f] flex flex-col overflow-hidden h-full">
          {/* Controls Bar */}
          <div className="p-6 border-b border-[#141520] bg-[#090a10]/50 space-y-4 shrink-0">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search endpoints by path, method, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#10111a] border border-[#1f202e] text-slate-200 placeholder:text-slate-600 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            
            {/* Method Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => {
                const isActive = selectedMethod === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMethod(m)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all ${
                      isActive 
                        ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/30" 
                        : "bg-[#10111a] text-slate-400 hover:text-slate-200 border border-[#1f202e] hover:border-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table container */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              {filteredEndpoints.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#1f202e] bg-[#0b0c13] text-center text-xs text-slate-500 italic">
                  No endpoints match your query.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#1f202e] bg-[#0b0c13] shadow-md">
                  <table className="min-w-full divide-y divide-[#141520] text-left text-xs">
                    <thead className="bg-[#0e0f17] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Path</th>
                        <th className="px-4 py-3">Auth</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-center">Params</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141520] text-slate-300">
                      {filteredEndpoints.map((ep, idx) => {
                        const isSelected = selectedEndpoint?.path === ep.path && selectedEndpoint?.method === ep.method;
                        const paramCount = ep.parameters?.length || 0;
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedEndpoint(ep)}
                            className={`cursor-pointer transition-all hover:bg-[#13141f]/40 ${
                              isSelected 
                                ? "bg-indigo-600/5 text-white font-medium" 
                                : ""
                            }`}
                          >
                            {/* Method Badge */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${getMethodBadgeStyle(ep.method)}`}>
                                {ep.method}
                              </span>
                            </td>
                            {/* Path */}
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-200">
                              {ep.path}
                            </td>
                            {/* Auth */}
                            <td className="px-4 py-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                              {authType}
                            </td>
                            {/* Description */}
                            <td className="px-4 py-3.5 text-slate-400 line-clamp-1 max-w-[200px]">
                              {ep.description}
                            </td>
                            {/* Params Count */}
                            <td className="px-4 py-3.5 text-center font-semibold text-slate-400">
                              {paramCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Endpoint details pane (40% width) */}
        <div className="col-span-12 lg:col-span-5 bg-[#07080b] flex flex-col overflow-hidden h-full">
          {selectedEndpoint ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-6">
                {/* Details Header */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded ${getMethodBadgeStyle(selectedEndpoint.method)}`}>
                      {selectedEndpoint.method}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-0.5 rounded">
                      {authType}
                    </span>
                  </div>
                  <h2 className="text-md font-bold text-white font-mono tracking-tight leading-snug break-all">
                    {selectedEndpoint.path}
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed bg-[#0c0d16] border border-[#1f202e] p-3.5 rounded-xl">
                    {selectedEndpoint.description || "No description provided."}
                  </p>
                </div>

                {/* Full Endpoint URL Card */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Full Endpoint URL</span>
                  <div className="flex items-center bg-[#10111a] border border-[#1f202e] rounded-xl overflow-hidden h-10 px-3 justify-between">
                    <span className="text-[11px] font-mono text-slate-300 truncate max-w-[80%] select-all">
                      {integration.url.replace(/\/$/, "")}{selectedEndpoint.path}
                    </span>
                    <Button
                      onClick={() => handleCopy(`${integration.url.replace(/\/$/, "")}${selectedEndpoint.path}`, setCopiedUrl)}
                      size="sm"
                      className="bg-[#12131f] hover:bg-[#1a1b2b] text-slate-300 hover:text-white rounded-lg border border-[#2b2c3d] text-[10px] h-7 px-2.5 gap-1"
                    >
                      {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                      {copiedUrl ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* Headers Card */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Required Headers</span>
                  <div className="bg-[#0c0d16] border border-[#1f202e] rounded-xl overflow-hidden divide-y divide-[#141520]">
                    {getRequiredHeaders(authType, selectedEndpoint.method).map((h, index) => (
                      <div key={index} className="p-3.5 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-200">{h.key}</span>
                          <span className="font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded text-[10px]">{h.value}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{h.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parameters Table Card */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Parameters ({selectedEndpoint.parameters?.length || 0})
                  </span>
                  {!selectedEndpoint.parameters || selectedEndpoint.parameters.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-[#1f202e] bg-[#0c0d16] text-[10px] text-slate-500 italic text-center">
                      No path or query parameters declared.
                    </div>
                  ) : (
                    <div className="bg-[#0c0d16] border border-[#1f202e] rounded-xl overflow-hidden divide-y divide-[#141520]">
                      {selectedEndpoint.parameters.map((p, index) => (
                        <div key={index} className="p-3.5 text-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-200">
                              {p.name}
                              {p.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                            </span>
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {p.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-normal">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Request Body Card (if exists) */}
                {selectedEndpoint.request_body_example && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Request Body Payload</span>
                    <div className="rounded-xl border border-[#1b1c2b] bg-[#040508] p-4 font-mono text-[10px] text-indigo-200/90 leading-relaxed overflow-x-auto">
                      <pre>{selectedEndpoint.request_body_example}</pre>
                    </div>
                  </div>
                )}

                {/* Mock CURL Request Card */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sample Curl Call</span>
                    <Button
                      onClick={() => handleCopy(getSampleCurl(integration.url, selectedEndpoint, authType), setCopiedCurl)}
                      size="sm"
                      className="bg-[#12131f] hover:bg-[#1a1b2b] text-slate-300 hover:text-white rounded-lg border border-[#2b2c3d] text-[10px] h-7 px-2.5 gap-1"
                    >
                      {copiedCurl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                      {copiedCurl ? "Copied" : "Copy Command"}
                    </Button>
                  </div>
                  <div className="rounded-xl border border-[#1b1c2b] bg-[#040508] p-4 font-mono text-[10px] text-indigo-200/90 leading-relaxed overflow-x-auto">
                    <pre>{getSampleCurl(integration.url, selectedEndpoint, authType)}</pre>
                  </div>
                </div>

                {/* Sample Response Card (if exists) */}
                {selectedEndpoint.response_body_example && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Sample Response JSON</span>
                    <div className="rounded-xl border border-[#1b1c2b] bg-[#040508] p-4 font-mono text-[10px] text-indigo-200/90 leading-relaxed overflow-x-auto">
                      <pre>{selectedEndpoint.response_body_example}</pre>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3.5 p-8 text-center bg-[#07080b]">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Compass className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">No Endpoint Selected</h3>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[220px] leading-normal">
                  Click on any row in the endpoints table to inspect headers, parameters, schemas, and live test commands.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  FileText, 
  Download, 
  MessageSquare, 
  Terminal, 
  Check, 
  Copy, 
  Globe, 
  Layers, 
  BookOpen, 
  Cpu, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { 
  getIntegration, 
  Integration, 
  getCodeExportUrl, 
  getPostmanExportUrl, 
  getPdfExportUrl 
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Endpoint {
  path: string;
  method: string;
  description: string;
  parameters?: Array<{ name: string; type: string; required: boolean; description: string }>;
  request_body_example?: string;
  response_body_example?: string;
}

export default function CodePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive selected endpoint for detailed view
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState<number>(0);
  
  // Copy feedback states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRequests, setCopiedRequests] = useState(false);
  const [copiedResponses, setCopiedResponses] = useState(false);
  const [showSubscriptionAlert, setShowSubscriptionAlert] = useState(false);

  // File download exporting states
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPostman, setExportingPostman] = useState(false);
  const [exportingCode, setExportingCode] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const data = await getIntegration(id);
        setIntegration(data);
        if (data.requires_subscription) {
          setShowSubscriptionAlert(true);
        }
        if (data.endpoints_json) {
          try {
            setEndpoints(JSON.parse(data.endpoints_json));
          } catch (e) {
            console.error("Failed to parse endpoints_json:", e);
          }
        }
      } catch (err: any) {
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

  const handleDownload = async (url: string, filename: string, setExportingState: (val: boolean) => void) => {
    setExportingState(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Download failed:", err);
      alert(err.message || "An error occurred while downloading the file.");
    } finally {
      setExportingState(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Cpu className="h-8 w-8 text-indigo-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Assembling integration assets...</span>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-3">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <span className="text-sm text-slate-400 font-semibold">{error || "Integration not found."}</span>
        <Button onClick={() => router.push("/dashboard")} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const host = new URL(integration.url).hostname;
  const activeEndpoint = endpoints[selectedEndpointIndex] || null;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#07080b] overflow-hidden">
      {/* Header Panel */}
      <header className="border-b border-[#141520] bg-[#090a10] px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-4.5 w-4.5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">{host}</h1>
            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              {integration.language} Client
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl mt-1">{integration.url}</p>
        </div>

        {/* Action Options */}
        <div className="flex flex-wrap gap-2.5">
          <Button 
            onClick={() => handleDownload(getPdfExportUrl(integration.id), `api_report_${integration.id}.pdf`, setExportingPdf)}
            disabled={exportingPdf}
            size="sm" 
            className="bg-[#10111a] hover:bg-[#181926] text-slate-300 hover:text-white border border-[#1f202e] rounded-xl text-[11px] font-semibold gap-1.5 h-9"
          >
            {exportingPdf ? (
              <Cpu className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
            )}
            {exportingPdf ? "Exporting..." : "Export PDF"}
          </Button>

          <Button 
            onClick={() => handleDownload(getPostmanExportUrl(integration.id), `postman_collection_${integration.id}.json`, setExportingPostman)}
            disabled={exportingPostman}
            size="sm" 
            className="bg-[#10111a] hover:bg-[#181926] text-slate-300 hover:text-white border border-[#1f202e] rounded-xl text-[11px] font-semibold gap-1.5 h-9"
          >
            {exportingPostman ? (
              <Cpu className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 text-indigo-400" />
            )}
            {exportingPostman ? "Exporting..." : "Postman JSON"}
          </Button>

          <Button 
            onClick={() => handleDownload(getCodeExportUrl(integration.id), `sdk_client_${integration.id}.zip`, setExportingCode)}
            disabled={exportingCode}
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-semibold gap-1.5 h-9"
          >
            {exportingCode ? (
              <Cpu className="h-3.5 w-3.5 text-slate-200 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 text-slate-200" />
            )}
            {exportingCode ? "Downloading..." : "Download Code"}
          </Button>
          <Button 
            onClick={() => router.push(`/chat/${integration.id}`)}
            size="sm" 
            className="bg-[#10111a] hover:bg-[#181926] text-slate-300 hover:text-white border border-[#1f202e] rounded-xl text-[11px] font-semibold gap-1.5 h-9"
          >
            <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
            Chat Assistant
          </Button>
        </div>
      </header>

      {/* Main Grid Split View */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden h-0 min-h-0">
        {/* Left column (Auth & Endpoints list) */}
        <div className="col-span-12 lg:col-span-4 border-r border-[#141520] bg-[#08090f] flex flex-col overflow-hidden h-full">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">
              {/* Auth details */}
              <Card className="bg-[#0b0c13] border-[#181926] rounded-xl shadow-md">
                <CardHeader className="pb-3.5 pt-4 px-4.5">
                  <CardTitle className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Authentication Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4.5 pb-4 text-slate-300 text-xs leading-relaxed space-y-2 prose prose-invert max-w-none">
                  {/* Clean line renders for auth markdown */}
                  {integration.auth_summary?.split("\n").map((line, index) => {
                    const isBold = line.startsWith("**") || line.startsWith("###");
                    return (
                      <p key={index} className={isBold ? "font-bold text-white mt-2" : ""}>
                        {line.replace(/\*\*/g, "")}
                      </p>
                    );
                  })}
                </CardContent>
              </Card>

              {/* SDK Recommendations */}
              <Card className="bg-[#0b0c13] border-[#181926] rounded-xl shadow-md">
                <CardHeader className="pb-3.5 pt-4 px-4.5">
                  <CardTitle className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    SDK Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4.5 pb-4 text-slate-300 text-xs leading-relaxed space-y-2">
                  {integration.sdk_recommendation?.split("\n").map((line, index) => {
                    if (line.trim().startsWith("#")) {
                      return <h4 key={index} className="font-bold text-white text-xs mt-3">{line.replace(/#/g, "").trim()}</h4>;
                    }
                    return <p key={index}>{line}</p>;
                  })}
                </CardContent>
              </Card>

              {/* Endpoint Selection list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Extracted Endpoints ({endpoints.length})
                  </span>
                </div>
                {endpoints.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-[#181926] bg-[#0c0d16] text-[11px] text-slate-500 italic text-center">
                    No relevant endpoints identified.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {endpoints.map((ep, idx) => {
                      const isSelected = selectedEndpointIndex === idx;
                      const isGet = ep.method.toUpperCase() === "GET";
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedEndpointIndex(idx)}
                          className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                            isSelected
                              ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                              : "bg-[#0c0d16] border-[#181926] text-slate-400 hover:border-[#2b2c3d]"
                          }`}
                        >
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${
                            isGet 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          } shrink-0`}>
                            {ep.method}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-mono font-bold block truncate text-slate-200">
                              {ep.path}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                              {ep.description}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right column (Tabs containing wrapper code / samples / markdown instructions) */}
        <div className="col-span-12 lg:col-span-8 bg-[#07080b] flex flex-col overflow-hidden h-full">
          <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="border-b border-[#141520] bg-[#090a10] px-6 h-12.5 flex items-center justify-between shrink-0">
              <TabsList className="bg-transparent border-0 gap-4 p-0">
                <TabsTrigger value="code" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none text-xs font-bold text-slate-400 px-1.5 py-3.5 border-b-2 border-transparent">
                  Wrapper Client
                </TabsTrigger>
                <TabsTrigger value="requests" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none text-xs font-bold text-slate-400 px-1.5 py-3.5 border-b-2 border-transparent">
                  Sample Requests
                </TabsTrigger>
                <TabsTrigger value="responses" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none text-xs font-bold text-slate-400 px-1.5 py-3.5 border-b-2 border-transparent">
                  Sample Responses
                </TabsTrigger>
                <TabsTrigger value="guide" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none text-xs font-bold text-slate-400 px-1.5 py-3.5 border-b-2 border-transparent">
                  Integration Steps
                </TabsTrigger>
              </TabsList>
              
              {/* Context active indicator */}
              {activeEndpoint && (
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 font-mono font-semibold bg-[#10111a] border border-[#181926] px-3 py-1 rounded-full">
                  <Terminal className="h-3 w-3 text-indigo-400" />
                  Focused: {activeEndpoint.path}
                </div>
              )}
            </div>

            {/* TAB CONTENTS */}
            
            {/* Wrapper Code */}
            <TabsContent value="code" className="flex-1 m-0 p-6 overflow-hidden flex flex-col relative focus-visible:ring-0 min-h-0">
              <div className="absolute top-9 right-9 z-10">
                <Button 
                  onClick={() => handleCopy(integration.generated_code || "", setCopiedCode)}
                  size="sm" 
                  className="bg-[#12131f] hover:bg-[#1a1b2b] text-slate-300 hover:text-white rounded-xl border border-[#2b2c3d] text-xs h-8 px-3 gap-1.5"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                  {copiedCode ? "Copied" : "Copy Code"}
                </Button>
              </div>
              <div className="flex-1 rounded-xl overflow-hidden border border-[#1b1c2b] bg-[#040508] p-4 flex min-h-0">
                <ScrollArea className="flex-1 font-mono text-[11px] text-indigo-200/90 leading-relaxed pr-3.5 min-h-0">
                  <pre>{integration.generated_code}</pre>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Requests */}
            <TabsContent value="requests" className="flex-1 m-0 p-6 overflow-hidden flex flex-col relative focus-visible:ring-0 min-h-0">
              <div className="absolute top-9 right-9 z-10">
                <Button 
                  onClick={() => handleCopy(integration.sample_requests || "", setCopiedRequests)}
                  size="sm" 
                  className="bg-[#12131f] hover:bg-[#1a1b2b] text-slate-300 hover:text-white rounded-xl border border-[#2b2c3d] text-xs h-8 px-3 gap-1.5"
                >
                  {copiedRequests ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                  {copiedRequests ? "Copied" : "Copy Requests"}
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                {/* Custom active endpoint params display */}
                {activeEndpoint && (
                  <Card className="bg-[#0b0c13] border-[#181926] rounded-xl shrink-0 p-4 space-y-2 text-xs">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Endpoint params</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{activeEndpoint.method}</span>
                      <span className="font-mono text-slate-200 font-bold">{activeEndpoint.path}</span>
                    </div>
                    {activeEndpoint.parameters && activeEndpoint.parameters.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {activeEndpoint.parameters.map((p, idx) => (
                          <div key={idx} className="p-2 rounded bg-[#10111a] border border-[#141520] flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-200">{p.name}</span>
                              <span className="text-[9px] text-slate-500 uppercase">{p.type} {p.required && <span className="text-rose-500">*</span>}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 line-clamp-1">{p.description}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic block pt-1">No custom query/header parameters declared.</span>
                    )}
                  </Card>
                )}
                
                <div className="flex-1 rounded-xl overflow-hidden border border-[#1b1c2b] bg-[#040508] p-4 flex min-h-0">
                  <ScrollArea className="flex-1 font-mono text-[11px] text-indigo-200/90 leading-relaxed pr-3.5 min-h-0">
                    <pre>{integration.sample_requests}</pre>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Responses */}
            <TabsContent value="responses" className="flex-1 m-0 p-6 overflow-hidden flex flex-col relative focus-visible:ring-0 min-h-0">
              <div className="absolute top-9 right-9 z-10">
                <Button 
                  onClick={() => handleCopy(integration.sample_responses || "", setCopiedResponses)}
                  size="sm" 
                  className="bg-[#12131f] hover:bg-[#1a1b2b] text-slate-300 hover:text-white rounded-xl border border-[#2b2c3d] text-xs h-8 px-3 gap-1.5"
                >
                  {copiedResponses ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                  {copiedResponses ? "Copied" : "Copy Response"}
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                {activeEndpoint && activeEndpoint.response_body_example && (
                  <Card className="bg-[#0b0c13] border-[#181926] rounded-xl shrink-0 p-4 space-y-2 text-xs">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Response schema description</span>
                    <p className="text-slate-300 text-xs">{activeEndpoint.description || "API Response object format."}</p>
                  </Card>
                )}
                <div className="flex-1 rounded-xl overflow-hidden border border-[#1b1c2b] bg-[#040508] p-4 flex min-h-0">
                  <ScrollArea className="flex-1 font-mono text-[11px] text-indigo-200/90 leading-relaxed pr-3.5 min-h-0">
                    <pre>{integration.sample_responses}</pre>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Guide */}
            <TabsContent value="guide" className="flex-1 m-0 p-0 overflow-hidden focus-visible:ring-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-8 max-w-3xl mx-auto space-y-6 text-slate-300 text-xs leading-relaxed prose prose-invert prose-indigo">
                  <div className="flex items-center gap-2 pb-4 border-b border-[#141520] mb-4 shrink-0">
                    <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
                    <h2 className="text-md font-bold text-white">Integration Setup Guide</h2>
                  </div>
                  {/* Clean line renders for guide markdown */}
                  {integration.integration_steps?.split("\n").map((line, index) => {
                    if (line.trim().startsWith("#")) {
                      const level = line.split("#").length - 1;
                      return (
                        <h3 key={index} className={`font-bold text-white mt-6 ${level === 2 ? "text-sm" : "text-xs border-b border-[#141520]/40 pb-1"}`}>
                          {line.replace(/#/g, "").trim()}
                        </h3>
                      );
                    }
                    if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
                      return <li key={index} className="ml-4 list-disc mt-1">{line.replace(/^[-*]\s*/, "")}</li>;
                    }
                    if (line.trim().startsWith("```")) {
                      return null; // Skip raw tags to preserve simple text flow
                    }
                    return <p key={index} className="mt-2.5">{line}</p>;
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {showSubscriptionAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <Card className="max-w-md w-full mx-4 bg-[#0c0d16]/90 border border-amber-500/30 shadow-2xl shadow-amber-950/10 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4 pt-6 border-b border-amber-500/10 bg-amber-500/5">
              <CardTitle className="text-white text-md font-bold flex items-center gap-2.5">
                <AlertCircle className="h-5.5 w-5.5 text-amber-400 animate-bounce" />
                Subscription Required Alert
              </CardTitle>
              <CardDescription className="text-xs text-amber-200/60 mt-0.5">
                This API integration requires a paid billing plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                We detected that this API (or the specific endpoints you selected) requires a <strong>paid subscription, pricing tier upgrade, or active developer billing config</strong>.
              </p>
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-300 flex gap-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <p>
                  Calling these endpoints without an active paid subscription plan will result in <strong>HTTP 402 Payment Required</strong> or <strong>HTTP 403 Forbidden</strong> responses.
                </p>
              </div>
              <p>
                Before deploying this SDK wrapper class, please visit your account dashboard at <strong>{host}</strong> to verify your payment status and upgrade if necessary.
              </p>
            </CardContent>
            <CardFooter className="p-4 border-t border-[#131420] flex justify-end">
              <Button 
                onClick={() => setShowSubscriptionAlert(false)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs px-5 py-2 animate-pulse"
              >
                Acknowledge & Continue
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

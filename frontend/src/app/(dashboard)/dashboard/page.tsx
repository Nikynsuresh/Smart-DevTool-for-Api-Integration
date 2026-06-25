"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Plus, 
  Trash2, 
  ArrowRight, 
  Terminal, 
  ExternalLink,
  Cpu,
  AlertCircle,
  Clock,
  CheckCircle,
  Database
} from "lucide-react";
import { listIntegrations, deleteIntegration, Integration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load integrations from backend
  async function loadData() {
    try {
      const data = await listIntegrations();
      setIntegrations(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to connect to FastAPI backend. Make sure the backend server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Poll integrations list every 3.5 seconds to dynamically update progress of background crawlers
    const timer = setInterval(() => {
      loadData();
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this integration and purge its vector index?")) return;
    try {
      await deleteIntegration(id);
      setIntegrations(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert("Failed to delete integration.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="h-3 w-3" /> Ready</span>;
      case "failed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="h-3 w-3" /> Failed</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"><Clock className="h-3 w-3" /> Pending</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"><Database className="h-3 w-3" /> {status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">API Integrations</h1>
          <p className="text-sm text-slate-400 mt-1">Manage, analyze, and communicate with your third-party API configurations.</p>
        </div>
        <Link href="/analyze" id="new_integration_btn">
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 rounded-xl px-5 py-2.5 shadow-lg shadow-indigo-600/15">
            <Plus className="h-4 w-4" />
            New Integration
          </Button>
        </Link>
      </div>

      {/* Backend Connection Check */}
      {error && (
        <div className="p-4.5 rounded-xl border border-rose-500/20 bg-rose-950/10 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <span className="font-semibold block">Backend Connection Error</span>
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-[#1f202c] bg-[#0c0d16] animate-pulse" />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1f202e] p-12 text-center max-w-xl mx-auto space-y-6">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <Cpu className="h-6 w-6 text-indigo-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-md font-bold text-white">No integrations found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Crawl your first API documentation URL to automatically compile code structures, auth helpers, and PDFs.
            </p>
          </div>
          <Link href="/analyze">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold gap-1.5 text-xs">
              Create Integration
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => {
            const host = new URL(integration.url).hostname;
            const isProcessing = integration.status !== "completed" && integration.status !== "failed";
            
            return (
              <Card key={integration.id} className="bg-[#0c0d16] border-[#1f202e] hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-indigo-400 shrink-0" />
                        <CardTitle className="text-base text-white font-bold truncate">
                          {host}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-slate-400 truncate font-mono">
                        {integration.url}
                      </CardDescription>
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Use case</span>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {integration.use_case}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target language</span>
                    <span className="font-semibold text-indigo-400 uppercase bg-indigo-500/5 px-2.5 py-0.5 rounded border border-indigo-500/10">
                      {integration.language}
                    </span>
                  </div>

                  {isProcessing && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400 font-medium animate-pulse">{integration.status}...</span>
                        <span className="text-slate-300 font-bold">{integration.progress}%</span>
                      </div>
                      <Progress value={integration.progress} className="h-1.5 bg-[#141520] [&>div]:bg-indigo-500" />
                    </div>
                  )}
                  
                  {integration.status === "failed" && (
                    <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-400 leading-normal flex gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p className="line-clamp-2">{integration.error_message}</p>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="pt-4 border-t border-[#131420] flex gap-3">
                  <Link href={integration.status === "completed" ? `/code/${integration.id}` : "#"} className="flex-1">
                    <Button 
                      disabled={integration.status !== "completed"}
                      className="w-full bg-[#181926] hover:bg-[#1f2034] text-slate-200 hover:text-white font-medium text-xs rounded-xl flex items-center gap-1.5 border border-[#2b2c3d]"
                    >
                      Open Integration
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    onClick={(e) => handleDelete(integration.id, e)}
                    className="h-9 w-9 p-0 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

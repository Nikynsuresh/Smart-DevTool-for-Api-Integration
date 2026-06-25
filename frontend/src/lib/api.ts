const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Integration {
  id: number;
  url: string;
  use_case: string;
  language: string;
  status: string;
  progress: number;
  error_message?: string;
  auth_summary?: string;
  sdk_recommendation?: string;
  integration_steps?: string;
  generated_code?: string;
  sample_requests?: string;
  sample_responses?: string;
  endpoints_json?: string;
  requires_subscription?: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function createIntegration(url: string, useCase: string, language: string, requiresSubscription: boolean = false): Promise<Integration> {
  const res = await fetch(`${API_BASE}/integrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, use_case: useCase, language, requires_subscription: requiresSubscription }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to create integration");
  }
  return res.json();
}

export async function listIntegrations(): Promise<Integration[]> {
  const res = await fetch(`${API_BASE}/integrations`);
  if (!res.ok) throw new Error("Failed to fetch integrations");
  return res.json();
}

export async function getIntegration(id: number | string): Promise<Integration> {
  const res = await fetch(`${API_BASE}/integrations/${id}`);
  if (!res.ok) throw new Error("Failed to fetch integration details");
  return res.json();
}

export async function deleteIntegration(id: number): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/integrations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete integration");
  return res.json();
}

export async function getChatHistory(id: number | string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/integrations/${id}/chat`);
  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json();
}

export async function sendChatMessage(id: number | string, message: string): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/integrations/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to send chat message");
  return res.json();
}

export function getCodeExportUrl(id: number): string {
  return `${API_BASE}/integrations/${id}/export/code`;
}

export function getPostmanExportUrl(id: number): string {
  return `${API_BASE}/integrations/${id}/export/postman`;
}

export function getPdfExportUrl(id: number): string {
  return `${API_BASE}/integrations/${id}/export/pdf`;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export type ApiIssue = {
  id: string;
  tenant_id: string;
  property_id: string;
  category: string;
  summary: string;
  description: string;
  status: string;
  vendor_id: string | null;
  estimated_cost: number | null;
  appointment_at: string | null;
  created_at: string;
};

export type ApiVendor = {
  id: string;
  name: string;
  email: string | null;
  specialty: string;
  hourly_rate: number;
  rating: number | null;
};

export type ApiProperty = {
  id: string;
  address: string;
  landlord_id: string;
  latitude: number | null;
  longitude: number | null;
};

export type ApiUser = {
  id: string;
  email: string;
  role: string;
  name: string;
  property_id: string | null;
};

export type WalletSummary = {
  property_id: string;
  balance: number;
  used: number;
  remaining: number;
};

export type ChatResponse = {
  response: string;
  issue_created: boolean;
  issue_id: string | null;
};

export type ApiChatMessage = {
  id: string;
  issue_id: string | null;
  property_id: string | null;
  tenant_id: string;
  role: string;
  content: string;
  image_base64: string | null;
  created_at: string;
};

export type ChatRequest = {
  tenant_id: string;
  message: string;
  image_base64?: string | null;
  issue_id?: string | null;
  property_id?: string | null;
};

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchIssues(): Promise<ApiIssue[]> {
  return fetchJson<ApiIssue[]>("/issues");
}

export async function fetchIssueMessages(issueId: string): Promise<ApiChatMessage[]> {
  return fetchJson<ApiChatMessage[]>(`/issues/${issueId}/messages`);
}

export async function postIssueMessage(
  issueId: string,
  payload: { tenant_id: string; content: string }
): Promise<ApiChatMessage> {
  return fetchJson<ApiChatMessage>(`/issues/${issueId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendVendorRequest(issueId: string, vendorId: string) {
  const response = await fetch(
    `${API_BASE_URL}/issues/${issueId}/vendor-request?vendor_id=${vendorId}`,
    { method: "POST" }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error ${response.status}`);
  }
  return (await response.json()) as { status: string };
}

export async function fetchVendors(): Promise<ApiVendor[]> {
  return fetchJson<ApiVendor[]>("/vendors");
}

export async function fetchProperties(): Promise<ApiProperty[]> {
  return fetchJson<ApiProperty[]>("/properties");
}

export async function fetchProperty(propertyId: string): Promise<ApiProperty> {
  return fetchJson<ApiProperty>(`/properties/${propertyId}`);
}

export async function fetchUser(userId: string): Promise<ApiUser> {
  return fetchJson<ApiUser>(`/users/${userId}`);
}

export async function fetchUsers(role?: string): Promise<ApiUser[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return fetchJson<ApiUser[]>(`/users${query}`);
}

export async function fetchWallets(): Promise<WalletSummary[]> {
  return fetchJson<WalletSummary[]>("/wallets");
}

export async function topupWallet(payload: {
  property_id: string;
  amount: number;
  note?: string;
}): Promise<WalletSummary> {
  return fetchJson<WalletSummary>("/wallets/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateWalletBalance(payload: {
  property_id: string;
  balance: number;
}): Promise<WalletSummary> {
  return fetchJson<WalletSummary>("/wallets/balance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function approveIssue(issueId: string): Promise<ApiIssue> {
  return fetchJson<ApiIssue>(`/issues/${issueId}/approve`, { method: "PATCH" });
}

export async function rejectIssue(issueId: string): Promise<ApiIssue> {
  return fetchJson<ApiIssue>(`/issues/${issueId}/reject`, { method: "PATCH" });
}

export async function postChat(payload: ChatRequest): Promise<ChatResponse> {
  return fetchJson<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function mapIssueStatus(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

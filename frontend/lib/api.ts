const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';

export interface Agent {
  id: number;
  name: string;
  description?: string;
  api_key?: string;
  public_key?: string;
  ip: string;
  status: string;
  last_seen?: string;
  group_id?: number;
  group?: Group;
  routes?: string;
  version?: string;
  services?: Service[];
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  agent_id: number;
  name: string;
  description: string;
  port: number;
  protocol: string;
  local_addr?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  agent_id?: number;
  agent?: Agent;
  action: string;
  details: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AccessLog {
  id: number;
  source_agent_id: number;
  source_agent?: Agent;
  dest_agent_id: number;
  dest_agent?: Agent;
  service_id?: number;
  service?: Service;
  action: string;
  port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  duration_ms: number;
  created_at: string;
}

export interface AgentMetrics {
  id: number;
  agent_id: number;
  heartbeat_latency_ms: number;
  bytes_sent: number;
  bytes_received: number;
  active_connections: number;
  failed_connections: number;
  cpu_usage?: number;
  memory_usage?: number;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  agents?: Agent[];
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: number;
  name: string;
  description: string;
  source_group_id: number;
  source_group?: Group;
  dest_group_id: number;
  dest_group?: Group;
  allowed_ports: string;
  action: string;
  enabled: boolean;
  // Zero Trust fields
  valid_from?: string;
  valid_until?: string;
  allowed_regions?: string;
  min_posture_score?: number;
  created_at: string;
  updated_at: string;
}

export interface DevicePosture {
  id: number;
  agent_id: number;
  os_name: string;
  os_version: string;
  hostname: string;
  antivirus_enabled: boolean;
  antivirus_name?: string;
  firewall_enabled: boolean;
  disk_encrypted: boolean;
  screen_lock_enabled: boolean;
  posture_score: number;
  last_checked?: string;
  created_at: string;
  updated_at: string;
}

// Ping result
export interface PingResult {
  source: string;
  destination: string;
  packets_sent: number;
  packets_recv: number;
  packet_loss: number;
  avg_latency: number;
  results: { seq: number; success: boolean; latency: number }[];
}

export interface PortCheckResult {
  source: string;
  destination: string;
  port: number;
  protocol: string;
  status: string;
  latency_ms: number;
  service?: string;
}

// Agents API
export async function getAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function getAgent(id: number): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch agent');
  return res.json();
}

export async function createAgent(data: { name: string; description?: string; group_id?: number }): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create agent');
  return res.json();
}

export async function updateAgent(id: number, data: { name?: string; description?: string; group_id?: number }): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update agent');
  return res.json();
}

export async function assignAgentGroup(id: number, groupId: number | null): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}/group`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  });
  if (!res.ok) throw new Error('Failed to assign group');
  return res.json();
}

export async function deleteAgent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete agent');
}

export async function regenerateAgentKey(id: number): Promise<{ api_key: string }> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}/regenerate-key`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to regenerate key');
  return res.json();
}

export async function updateAgentRoutes(id: number, routes: string[]): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}/routes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routes }),
  });
  if (!res.ok) throw new Error('Failed to update routes');
  return res.json();
}

// Metrics API
export async function getAgentMetrics(agentId: number, limit = 100): Promise<AgentMetrics[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/metrics?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function getAgentAccessLogs(agentId: number, limit = 100): Promise<AccessLog[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/access-logs?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch access logs');
  return res.json();
}

// Services API
export async function getAgentServices(agentId: number): Promise<Service[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/services`);
  if (!res.ok) throw new Error('Failed to fetch services');
  return res.json();
}

export async function createService(agentId: number, data: Partial<Service>): Promise<Service> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create service');
  return res.json();
}

export async function deleteService(agentId: number, serviceId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/services/${serviceId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete service');
}

// Audit Logs API
export async function getAuditLogs(params?: { agent_id?: number; action?: string; limit?: number }): Promise<AuditLog[]> {
  const query = new URLSearchParams();
  if (params?.agent_id) query.set('agent_id', String(params.agent_id));
  if (params?.action) query.set('action', params.action);
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/v1/audit-logs?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function getAgentAuditLogs(agentId: number, limit = 50): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/audit-logs?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch agent audit logs');
  return res.json();
}

// Debug Tools API
export async function pingAgent(sourceId: number, destId: number, count = 4): Promise<PingResult> {
  const res = await fetch(`${API_BASE}/api/v1/debug/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_agent_id: sourceId, dest_agent_id: destId, count }),
  });
  if (!res.ok) throw new Error('Failed to ping');
  return res.json();
}

export async function checkPort(sourceId: number, destId: number, port: number, protocol = 'tcp'): Promise<PortCheckResult> {
  const res = await fetch(`${API_BASE}/api/v1/debug/port-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_agent_id: sourceId, dest_agent_id: destId, port, protocol }),
  });
  if (!res.ok) throw new Error('Failed to check port');
  return res.json();
}

export async function traceroute(sourceId: number, destId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/debug/traceroute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_agent_id: sourceId, dest_agent_id: destId }),
  });
  if (!res.ok) throw new Error('Failed to traceroute');
  return res.json();
}

export async function dnsLookup(sourceId: number, domain: string, recordType = "A"): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/debug/dns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_agent_id: sourceId, domain, record_type: recordType }),
  });
  if (!res.ok) throw new Error('Failed to lookup DNS');
  return res.json();
}

export async function httpCheck(sourceId: number, url: string, method = "GET"): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/debug/http`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_agent_id: sourceId, url, method }),
  });
  if (!res.ok) throw new Error('Failed to check HTTP');
  return res.json();
}

// Groups API
export async function getGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/api/v1/groups`);
  if (!res.ok) throw new Error('Failed to fetch groups');
  return res.json();
}

export async function createGroup(data: { name: string; description?: string }): Promise<Group> {
  const res = await fetch(`${API_BASE}/api/v1/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create group');
  return res.json();
}

export async function updateGroup(id: number, data: { name?: string; description?: string }): Promise<Group> {
  const res = await fetch(`${API_BASE}/api/v1/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update group');
  return res.json();
}

export async function deleteGroup(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/groups/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete group');
}

// Policies API
export async function getPolicies(): Promise<Policy[]> {
  const res = await fetch(`${API_BASE}/api/v1/policies`);
  if (!res.ok) throw new Error('Failed to fetch policies');
  return res.json();
}

export async function createPolicy(data: Partial<Policy>): Promise<Policy> {
  const res = await fetch(`${API_BASE}/api/v1/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create policy');
  return res.json();
}

export async function updatePolicy(id: number, data: Partial<Policy>): Promise<Policy> {
  const res = await fetch(`${API_BASE}/api/v1/policies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update policy');
  return res.json();
}

export async function deletePolicy(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/policies/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy');
}

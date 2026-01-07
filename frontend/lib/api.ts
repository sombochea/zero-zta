const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';

export interface Agent {
  id: number;
  name: string;
  api_key?: string;
  public_key?: string;
  ip: string;
  status: string;
  last_seen?: string;
  group_id?: number;
  group?: Group;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

// Agents API
export async function getAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/api/v1/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function createAgent(data: { name: string; group_id?: number }): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create agent');
  return res.json();
}

export async function deleteAgent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/agents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete agent');
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

export async function deletePolicy(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/policies/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy');
}

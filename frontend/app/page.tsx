"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { getAgents, getGroups, getPolicies, Agent, Group, Policy } from "@/lib/api";
import {
  Users, FolderTree, Shield, Wifi, WifiOff, ArrowRight, Server,
  ShieldCheck, ShieldAlert, Lock, Unlock, Activity, Globe,
  CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsData, groupsData, policiesData] = await Promise.all([
          getAgents(),
          getGroups(),
          getPolicies(),
        ]);
        setAgents(agentsData);
        setGroups(groupsData);
        setPolicies(policiesData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const onlineAgents = agents.filter(a => a.status === "online").length;
  const offlineAgents = agents.filter(a => a.status === "offline").length;
  const activePolicies = policies.filter(p => p.enabled).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with gradient */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent rounded-2xl -z-10" />
        <div className="py-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
            Zero Trust Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time overview of your secure network infrastructure
          </p>
        </div>
      </div>

      {/* Network Health Banner */}
      <Card className="border-none bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Network Security Status</h3>
                <p className="text-muted-foreground text-sm">
                  {onlineAgents > 0
                    ? `${onlineAgents} agent${onlineAgents > 1 ? 's' : ''} connected and protected`
                    : 'No agents currently online'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{onlineAgents}</div>
                <div className="text-xs text-muted-foreground">Online</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{offlineAgents}</div>
                <div className="text-xs text-muted-foreground">Offline</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{activePolicies}</div>
                <div className="text-xs text-muted-foreground">Policies</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active network endpoints
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-green-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{onlineAgents}</div>
            <div className="mt-2">
              <Progress
                value={agents.length > 0 ? (onlineAgents / agents.length) * 100 : 0}
                className="h-1.5 bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
            <FolderTree className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Access control segments
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policies</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{policies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-500">{activePolicies} active</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Agents */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Network Agents</CardTitle>
              <CardDescription>Connected devices in your network</CardDescription>
            </div>
            <Link href="/agents" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-12">
                <Server className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  No agents registered yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 5).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 group border border-transparent hover:border-primary/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Server className="h-5 w-5 text-primary/70" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{agent.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{agent.ip}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.group && (
                        <Badge variant="outline" className="hidden sm:inline-flex">{agent.group.name}</Badge>
                      )}
                      <Badge
                        variant={agent.status === 'online' ? 'default' : 'secondary'}
                        className={agent.status === 'online' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Policies */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Active Policies</CardTitle>
              <CardDescription>Zero Trust access rules</CardDescription>
            </div>
            <Link href="/policies" className="text-sm text-primary hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  No policies configured yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {policies.slice(0, 5).map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${policy.enabled
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                        {policy.enabled ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {policy.source_group?.name || 'Any'} → {policy.dest_group?.name || 'Any'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={policy.action === 'allow' ? 'default' : 'destructive'}>
                        {policy.action}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zero Trust Features Banner */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-medium">Zero Trust Controls</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-500" />
                <span>Device Posture</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span>Time-Based Access</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-500" />
                <span>Geo-Restriction</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

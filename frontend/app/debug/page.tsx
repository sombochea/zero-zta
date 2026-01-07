"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getAgents, pingAgent, checkPort, traceroute, Agent, PingResult, PortCheckResult } from "@/lib/api";
import { Radio, Plug, Route, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DebugToolsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected agents
    const [sourceId, setSourceId] = useState<number>(0);
    const [destId, setDestId] = useState<number>(0);

    // Tool states
    const [pingResult, setPingResult] = useState<PingResult | null>(null);
    const [portResult, setPortResult] = useState<PortCheckResult | null>(null);
    const [tracerouteResult, setTracerouteResult] = useState<any>(null);
    const [port, setPort] = useState("80");
    const [running, setRunning] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAgents() {
            try {
                const data = await getAgents();
                setAgents(data);
                if (data.length >= 2) {
                    setSourceId(data[0].id);
                    setDestId(data[1].id);
                }
            } catch (error) {
                toast.error("Failed to fetch agents");
            } finally {
                setLoading(false);
            }
        }
        fetchAgents();
    }, []);

    const runPing = async () => {
        if (!sourceId || !destId) return;
        setRunning("ping");
        setPingResult(null);
        try {
            const result = await pingAgent(sourceId, destId);
            setPingResult(result);
            toast.success("Ping completed");
        } catch (error) {
            toast.error("Ping failed");
        } finally {
            setRunning(null);
        }
    };

    const runPortCheck = async () => {
        if (!sourceId || !destId || !port) return;
        setRunning("port");
        setPortResult(null);
        try {
            const result = await checkPort(sourceId, destId, parseInt(port));
            setPortResult(result);
            toast.success("Port check completed");
        } catch (error) {
            toast.error("Port check failed");
        } finally {
            setRunning(null);
        }
    };

    const runTraceroute = async () => {
        if (!sourceId || !destId) return;
        setRunning("traceroute");
        setTracerouteResult(null);
        try {
            const result = await traceroute(sourceId, destId);
            setTracerouteResult(result);
            toast.success("Traceroute completed");
        } catch (error) {
            toast.error("Traceroute failed");
        } finally {
            setRunning(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const sourceAgent = agents.find(a => a.id === sourceId);
    const destAgent = agents.find(a => a.id === destId);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Debug Tools</h1>
                <p className="text-muted-foreground">
                    Test connectivity between agents in the VPN network
                </p>
            </div>

            {agents.length < 2 ? (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <CardContent className="pt-6">
                        <p className="text-yellow-800 dark:text-yellow-200">
                            You need at least 2 agents to use debug tools. Create more agents first.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Agent Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Agents</CardTitle>
                            <CardDescription>Choose source and destination agents for testing</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Source Agent</Label>
                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                                        value={sourceId}
                                        onChange={(e) => setSourceId(parseInt(e.target.value))}
                                    >
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name} ({agent.ip}) - {agent.status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Destination Agent</Label>
                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                                        value={destId}
                                        onChange={(e) => setDestId(parseInt(e.target.value))}
                                    >
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name} ({agent.ip}) - {agent.status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tools */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Ping */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Radio className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-lg">Ping</CardTitle>
                                </div>
                                <CardDescription>Test network reachability</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button
                                    onClick={runPing}
                                    disabled={running === "ping"}
                                    className="w-full"
                                >
                                    {running === "ping" ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
                                    ) : (
                                        <><Play className="mr-2 h-4 w-4" /> Run Ping</>
                                    )}
                                </Button>

                                {pingResult && (
                                    <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
                                        <p>From: {pingResult.source}</p>
                                        <p>To: {pingResult.destination}</p>
                                        <div className="border-t pt-2 mt-2">
                                            {pingResult.results.map((r) => (
                                                <p key={r.seq} className={r.success ? "text-green-600" : "text-red-600"}>
                                                    seq={r.seq}: {r.success ? `${r.latency}ms` : "timeout"}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="border-t pt-2">
                                            <p>Packet loss: {pingResult.packet_loss.toFixed(0)}%</p>
                                            <p>Avg latency: {pingResult.avg_latency.toFixed(1)}ms</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Port Check */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Plug className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-lg">Port Check</CardTitle>
                                </div>
                                <CardDescription>Test port connectivity</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Port</Label>
                                    <Input
                                        type="number"
                                        value={port}
                                        onChange={(e) => setPort(e.target.value)}
                                        placeholder="80"
                                    />
                                </div>
                                <Button
                                    onClick={runPortCheck}
                                    disabled={running === "port"}
                                    className="w-full"
                                >
                                    {running === "port" ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
                                    ) : (
                                        <><Play className="mr-2 h-4 w-4" /> Check Port</>
                                    )}
                                </Button>

                                {portResult && (
                                    <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
                                        <p>Target: {portResult.destination}</p>
                                        <p>Port: {portResult.port}/{portResult.protocol}</p>
                                        <p className="flex items-center gap-2">
                                            Status:
                                            <Badge variant={portResult.status === "open" ? "default" : "destructive"}>
                                                {portResult.status}
                                            </Badge>
                                        </p>
                                        {portResult.service && <p>Service: {portResult.service}</p>}
                                        <p>Latency: {portResult.latency_ms}ms</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Traceroute */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Route className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-lg">Traceroute</CardTitle>
                                </div>
                                <CardDescription>Trace network path</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button
                                    onClick={runTraceroute}
                                    disabled={running === "traceroute"}
                                    className="w-full"
                                >
                                    {running === "traceroute" ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tracing...</>
                                    ) : (
                                        <><Play className="mr-2 h-4 w-4" /> Run Traceroute</>
                                    )}
                                </Button>

                                {tracerouteResult && (
                                    <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
                                        <p>From: {tracerouteResult.source}</p>
                                        <p>To: {tracerouteResult.destination}</p>
                                        <div className="border-t pt-2 mt-2">
                                            {tracerouteResult.hops?.map((hop: any) => (
                                                <p key={hop.hop}>
                                                    {hop.hop}. {hop.host} ({hop.ip}) - {hop.latency}ms
                                                </p>
                                            ))}
                                        </div>
                                        <p className="border-t pt-2">Total hops: {tracerouteResult.total_hops}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

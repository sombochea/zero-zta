"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    getAgents,
    pingAgent,
    checkPort,
    traceroute,
    dnsLookup,
    httpCheck,
    Agent,
    PingResult,
    PortCheckResult
} from "@/lib/api";
import {
    Radio,
    Plug,
    Route,
    Play,
    Loader2,
    Terminal,
    Search,
    Globe,
    CheckCircle2,
    XCircle,
    Clock,
    Trash2,
    ArrowRight,
    Activity
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ToolType = "ping" | "port" | "traceroute" | "dns" | "http";

interface ConsoleEntry {
    id: string;
    type: ToolType | "error";
    data: any;
    timestamp: Date;
}

export default function DebugToolsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected agents
    const [sourceId, setSourceId] = useState<string>("");
    const [destId, setDestId] = useState<string>("");

    // Tool params
    const [activeTool, setActiveTool] = useState<ToolType>("ping");
    const [consoleOutput, setConsoleOutput] = useState<ConsoleEntry[]>([]);
    const [port, setPort] = useState("80");
    const [domain, setDomain] = useState("google.com");
    const [url, setUrl] = useState("https://google.com");
    const [running, setRunning] = useState(false);

    useEffect(() => {
        async function fetchAgents() {
            try {
                const data = await getAgents();
                setAgents(data);
                if (data.length >= 1) {
                    setSourceId(String(data[0].id));
                    if (data.length >= 2) {
                        setDestId(String(data[1].id));
                    }
                }
            } catch (error) {
                toast.error("Failed to fetch agents");
            } finally {
                setLoading(false);
            }
        }
        fetchAgents();
    }, []);

    const addToConsole = (type: ToolType | "error", data: any) => {
        const entry: ConsoleEntry = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            data,
            timestamp: new Date()
        };
        setConsoleOutput(prev => [entry, ...prev]);
    };

    const clearConsole = () => setConsoleOutput([]);

    const runDiagnostic = async () => {
        if (!sourceId) {
            toast.error("Please select a source agent");
            return;
        }

        if ((activeTool === "ping" || activeTool === "port" || activeTool === "traceroute") && !destId) {
            toast.error("Please select a destination agent");
            return;
        }

        setRunning(true);

        try {
            let result;
            switch (activeTool) {
                case "ping":
                    result = await pingAgent(Number(sourceId), Number(destId));
                    break;
                case "port":
                    result = await checkPort(Number(sourceId), Number(destId), parseInt(port));
                    break;
                case "traceroute":
                    result = await traceroute(Number(sourceId), Number(destId));
                    break;
                case "dns":
                    result = await dnsLookup(Number(sourceId), domain);
                    break;
                case "http":
                    result = await httpCheck(Number(sourceId), url);
                    break;
            }
            addToConsole(activeTool, result);
            toast.success("Diagnostic completed");
        } catch (error) {
            addToConsole("error", { message: `${activeTool} failed to execute` });
            toast.error("Diagnostic failed");
        } finally {
            setRunning(false);
        }
    };

    const getSourceAgent = () => agents.find(a => String(a.id) === sourceId);
    const getDestAgent = () => agents.find(a => String(a.id) === destId);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        );
    }

    const RenderConsoleEntry = ({ entry }: { entry: ConsoleEntry }) => {
        const { type, data, timestamp } = entry;
        const timeStr = timestamp.toLocaleTimeString();

        if (type === "error") {
            return (
                <div className="border-l-2 border-red-500 pl-4 py-2">
                    <div className="flex items-center gap-2 text-red-500">
                        <XCircle className="h-4 w-4" />
                        <span className="font-medium">Error</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <p className="text-sm text-red-400 mt-1">{data.message}</p>
                </div>
            );
        }

        if (type === "ping") {
            const res = data as PingResult;
            const successRate = ((res.packets_recv / res.packets_sent) * 100).toFixed(0);
            return (
                <div className="border-l-2 border-blue-500 pl-4 py-2">
                    <div className="flex items-center gap-2 text-blue-500">
                        <Radio className="h-4 w-4" />
                        <span className="font-medium">Ping Test</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Source:</span> {res.source}
                        </div>
                        <div>
                            <span className="text-muted-foreground">Destination:</span> {res.destination}
                        </div>
                    </div>
                    <div className="mt-3 flex gap-4">
                        <div className="bg-muted rounded-lg px-4 py-2 text-center">
                            <div className="text-2xl font-bold">{res.avg_latency.toFixed(1)}ms</div>
                            <div className="text-xs text-muted-foreground">Avg Latency</div>
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2 text-center">
                            <div className={cn("text-2xl font-bold", Number(successRate) === 100 ? "text-green-500" : "text-yellow-500")}>
                                {successRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">Success Rate</div>
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2 text-center">
                            <div className="text-2xl font-bold">{res.packets_sent}</div>
                            <div className="text-xs text-muted-foreground">Packets</div>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-1">
                        {res.results.map(r => (
                            <div
                                key={r.seq}
                                className={cn(
                                    "w-8 h-8 rounded flex items-center justify-center text-xs font-mono",
                                    r.success ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}
                                title={r.success ? `${r.latency}ms` : "timeout"}
                            >
                                {r.success ? r.latency : "×"}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === "port") {
            const res = data as PortCheckResult;
            const isOpen = res.status === "open";
            return (
                <div className={cn("border-l-2 pl-4 py-2", isOpen ? "border-green-500" : "border-red-500")}>
                    <div className="flex items-center gap-2">
                        <Plug className={cn("h-4 w-4", isOpen ? "text-green-500" : "text-red-500")} />
                        <span className="font-medium">Port Check</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                        <code className="bg-muted px-2 py-1 rounded">{res.destination}:{res.port}</code>
                        <div className={cn("flex items-center gap-1", isOpen ? "text-green-500" : "text-red-500")}>
                            {isOpen ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            {res.status.toUpperCase()}
                        </div>
                        {res.service && <span className="text-muted-foreground">Service: {res.service}</span>}
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {res.latency_ms}ms
                        </span>
                    </div>
                </div>
            );
        }

        if (type === "traceroute") {
            return (
                <div className="border-l-2 border-yellow-500 pl-4 py-2">
                    <div className="flex items-center gap-2 text-yellow-500">
                        <Route className="h-4 w-4" />
                        <span className="font-medium">Traceroute</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Route to</span> {data.destination}
                    </div>
                    <div className="mt-2 space-y-1">
                        {data.hops?.map((hop: any) => (
                            <div key={hop.hop} className="flex items-center gap-4 text-sm font-mono">
                                <span className="w-6 text-muted-foreground">{hop.hop}</span>
                                <span className="flex-1">{hop.host} <span className="text-muted-foreground">({hop.ip})</span></span>
                                <span className="text-blue-400">{hop.latency}ms</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === "dns") {
            return (
                <div className="border-l-2 border-cyan-500 pl-4 py-2">
                    <div className="flex items-center gap-2 text-cyan-500">
                        <Search className="h-4 w-4" />
                        <span className="font-medium">DNS Lookup</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <div className="mt-2 text-sm">
                        <code className="bg-muted px-2 py-1 rounded">{data.domain}</code>
                        <span className="text-muted-foreground ml-2">({data.record_type})</span>
                    </div>
                    <div className="mt-2 space-y-1">
                        {data.records?.map((record: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <ArrowRight className="h-3 w-3 text-cyan-500" />
                                <code>{record}</code>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                        Server: {data.server} • {data.latency_ms}ms
                    </div>
                </div>
            );
        }

        if (type === "http") {
            const isSuccess = data.status_code >= 200 && data.status_code < 300;
            return (
                <div className={cn("border-l-2 pl-4 py-2", isSuccess ? "border-green-500" : "border-orange-500")}>
                    <div className="flex items-center gap-2">
                        <Globe className={cn("h-4 w-4", isSuccess ? "text-green-500" : "text-orange-500")} />
                        <span className="font-medium">HTTP Check</span>
                        <span className="text-xs opacity-60 ml-auto">{timeStr}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="font-mono bg-muted px-2 py-1 rounded">{data.method}</span>
                        <code className="truncate max-w-[300px]">{data.url}</code>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className={cn("px-2 py-1 rounded text-xs font-bold", isSuccess ? "bg-green-500/20 text-green-500" : "bg-orange-500/20 text-orange-500")}>
                            {data.status_code} {data.status_text}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {data.duration_ms}ms
                        </span>
                        {data.used_vpn !== undefined && (
                            <span className={cn("text-xs px-1.5 py-0.5 rounded border", data.used_vpn ? "bg-blue-500/10 text-blue-500 border-blue-200" : "bg-zinc-500/10 text-zinc-500 border-zinc-200")}>
                                {data.used_vpn ? "Via VPN" : "Via Internet"}
                            </span>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Terminal className="h-6 w-6 text-primary" />
                        </div>
                        Network Diagnostics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Test connectivity and debug network issues between agents
                    </p>
                </div>
            </div>

            {agents.length < 1 ? (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <CardContent className="pt-6">
                        <p className="text-yellow-800 dark:text-yellow-200">
                            You need at least 1 agent to use debug tools. Create agents first.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <Card className="xl:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg">Configuration</CardTitle>
                            <CardDescription>Select agents and diagnostic tool</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Agent Selection */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Source Agent</Label>
                                    <Select value={sourceId} onValueChange={setSourceId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select agent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agents.map(a => (
                                                <SelectItem key={a.id} value={String(a.id)}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", a.status === "online" ? "bg-green-500" : "bg-gray-400")} />
                                                        {a.name}
                                                        <span className="text-xs text-muted-foreground">({a.ip})</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(activeTool === "ping" || activeTool === "port" || activeTool === "traceroute") && (
                                    <div className="space-y-2">
                                        <Label>Destination Agent</Label>
                                        <Select value={destId} onValueChange={setDestId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select agent" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {agents.map(a => (
                                                    <SelectItem key={a.id} value={String(a.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("w-2 h-2 rounded-full", a.status === "online" ? "bg-green-500" : "bg-gray-400")} />
                                                            {a.name}
                                                            <span className="text-xs text-muted-foreground">({a.ip})</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Tool Selection */}
                            <Tabs value={activeTool} onValueChange={(v) => setActiveTool(v as ToolType)}>
                                <TabsList className="grid grid-cols-5 w-full">
                                    <TabsTrigger value="ping" className="text-xs">
                                        <Radio className="h-4 w-4" />
                                    </TabsTrigger>
                                    <TabsTrigger value="port" className="text-xs">
                                        <Plug className="h-4 w-4" />
                                    </TabsTrigger>
                                    <TabsTrigger value="traceroute" className="text-xs">
                                        <Route className="h-4 w-4" />
                                    </TabsTrigger>
                                    <TabsTrigger value="dns" className="text-xs">
                                        <Search className="h-4 w-4" />
                                    </TabsTrigger>
                                    <TabsTrigger value="http" className="text-xs">
                                        <Globe className="h-4 w-4" />
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="ping" className="mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Test network connectivity between two agents using ICMP-like ping.
                                    </div>
                                </TabsContent>

                                <TabsContent value="port" className="mt-4 space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                        Check if a specific port is open on the destination agent.
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Port Number</Label>
                                        <Input
                                            type="number"
                                            value={port}
                                            onChange={(e) => setPort(e.target.value)}
                                            placeholder="80"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="traceroute" className="mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Trace the network path between two agents.
                                    </div>
                                </TabsContent>

                                <TabsContent value="dns" className="mt-4 space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                        Perform DNS lookup from the source agent.
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Domain Name</Label>
                                        <Input
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value)}
                                            placeholder="google.com"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="http" className="mt-4 space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                        Test HTTP connectivity from the source agent.
                                    </div>
                                    <div className="space-y-2">
                                        <Label>URL</Label>
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://google.com"
                                        />
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <Button
                                className="w-full"
                                size="lg"
                                onClick={runDiagnostic}
                                disabled={running}
                            >
                                {running ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
                                ) : (
                                    <><Play className="mr-2 h-4 w-4" /> Run Diagnostic</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Results Panel */}
                    <Card className="xl:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    Results
                                </CardTitle>
                                <CardDescription>
                                    {consoleOutput.length} diagnostic{consoleOutput.length !== 1 ? "s" : ""} run
                                </CardDescription>
                            </div>
                            {consoleOutput.length > 0 && (
                                <Button variant="outline" size="sm" onClick={clearConsole}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
                                {consoleOutput.length === 0 ? (
                                    <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                                        <Terminal className="h-16 w-16 opacity-20 mb-4" />
                                        <p className="text-lg font-medium">No results yet</p>
                                        <p className="text-sm">Run a diagnostic to see results here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {consoleOutput.map(entry => (
                                            <RenderConsoleEntry key={entry.id} entry={entry} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

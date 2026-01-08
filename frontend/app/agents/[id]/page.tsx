"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    getAgent,
    getAgentServices,
    getAgentAuditLogs,
    createService,
    deleteService,
    regenerateAgentKey,
    updateAgentRoutes,
    updateAgent,
    getGroups,
    getAgentMetrics,
    getAgentAccessLogs,
    getPolicies,
    Agent,
    Service,
    AuditLog,
    Group,
    AgentMetrics,
    AccessLog,
    Policy
} from "@/lib/api";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Key,
    Copy,
    Eye,
    EyeOff,
    Router,
    Activity,
    Settings2,
    Server,
    Edit,
    BarChart3,
    ArrowUp,
    ArrowDown,
    Shield,
    CheckCircle2,
    XCircle,
    Clock,
    Terminal,
    Network,
    Cpu,
    Zap,
    Globe
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AgentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const agentId = Number(params.id);

    const [agent, setAgent] = useState<Agent | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
    const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [keyDialogOpen, setKeyDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [newApiKey, setNewApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);

    // Form states
    const [newService, setNewService] = useState({ name: "", port: "", protocol: "tcp", description: "" });
    const [routes, setRoutes] = useState<string[]>([]);
    const [newRoute, setNewRoute] = useState("");
    const [editForm, setEditForm] = useState({ name: "", description: "", group_id: "0" });

    const fetchData = async () => {
        try {
            const [agentData, servicesData, logsData, groupsData, metricsData, accessLogsData, policiesData] = await Promise.all([
                getAgent(agentId),
                getAgentServices(agentId),
                getAgentAuditLogs(agentId),
                getGroups(),
                getAgentMetrics(agentId),
                getAgentAccessLogs(agentId),
                getPolicies()
            ]);
            setAgent(agentData);
            setServices(servicesData);
            setAuditLogs(logsData);
            setGroups(groupsData);
            setMetrics(metricsData);
            setAccessLogs(accessLogsData);
            setPolicies(policiesData);

            // Init edit form
            setEditForm({
                name: agentData.name,
                description: agentData.description || "",
                group_id: agentData.group_id ? String(agentData.group_id) : "0"
            });

            // Parse routes
            if (agentData.routes) {
                try {
                    setRoutes(JSON.parse(agentData.routes));
                } catch {
                    setRoutes([]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch agent:", error);
            toast.error("Failed to load agent details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [agentId]);

    const handleUpdateAgent = async () => {
        try {
            await updateAgent(agentId, {
                name: editForm.name,
                description: editForm.description,
                group_id: editForm.group_id === "0" ? undefined : Number(editForm.group_id)
            });
            toast.success("Agent updated");
            setEditDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to update agent");
        }
    };

    const handleCreateService = async () => {
        if (!newService.name || !newService.port) return;

        try {
            await createService(agentId, {
                name: newService.name,
                port: parseInt(newService.port),
                protocol: newService.protocol,
                description: newService.description,
            });
            toast.success("Service added successfully");
            setNewService({ name: "", port: "", protocol: "tcp", description: "" });
            setServiceDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to create service");
        }
    };

    const handleDeleteService = async (serviceId: number) => {
        if (!confirm("Delete this service?")) return;

        try {
            await deleteService(agentId, serviceId);
            toast.success("Service deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete service");
        }
    };

    const handleRegenerateKey = async () => {
        if (!confirm("This will invalidate the current API key. The agent will need to reconnect with the new key. Continue?")) return;

        try {
            const result = await regenerateAgentKey(agentId);
            setNewApiKey(result.api_key);
            setKeyDialogOpen(true);
            toast.success("API key regenerated");
            fetchData();
        } catch (error) {
            toast.error("Failed to regenerate key");
        }
    };

    const handleAddRoute = async () => {
        if (!newRoute.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/)) {
            toast.error("Invalid CIDR format (e.g., 192.168.1.0/24)");
            return;
        }

        const updatedRoutes = [...routes, newRoute];
        try {
            await updateAgentRoutes(agentId, updatedRoutes);
            setRoutes(updatedRoutes);
            setNewRoute("");
            toast.success("Route added");
        } catch (error) {
            toast.error("Failed to add route");
        }
    };

    const handleRemoveRoute = async (route: string) => {
        const updatedRoutes = routes.filter(r => r !== route);
        try {
            await updateAgentRoutes(agentId, updatedRoutes);
            setRoutes(updatedRoutes);
            toast.success("Route removed");
        } catch (error) {
            toast.error("Failed to remove route");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const getEffectivePolicies = () => {
        if (!agent?.group_id) return { inbound: [], outbound: [] };
        const inbound = policies.filter(p => p.dest_group_id === agent.group_id && p.enabled);
        const outbound = policies.filter(p => p.source_group_id === agent.group_id && p.enabled);
        return { inbound, outbound };
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full col-span-2" />
                </div>
            </div>
        );
    }

    if (!agent) {
        return <div>Agent not found</div>;
    }

    const latestMetric = metrics.length > 0 ? metrics[0] : null;
    const { inbound, outbound } = getEffectivePolicies();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Modern Hero Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background to-secondary/30 border p-8">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-secondary" asChild>
                                <Link href="/agents">
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                    {agent.name}
                                </h1>
                                <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                                    <Activity className={cn("h-4 w-4", agent.status === "online" ? "text-green-500" : "text-zinc-500")} />
                                    <span className="text-sm font-medium">{agent.status.toUpperCase()}</span>
                                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                    <span className="font-mono text-sm">{agent.ip}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 backdrop-blur-sm rounded-lg border shadow-sm">
                            <Shield className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                                {agent.group ? agent.group.name : "Unassigned"}
                            </span>
                        </div>
                        <div className="h-8 w-[1px] bg-border hidden md:block"></div>
                        <Button variant="outline" className="shadow-sm" onClick={() => setEditDialogOpen(true)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <Button variant="destructive" size="icon" className="shadow-sm" onClick={handleRegenerateKey}>
                            <Key className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/5 rounded-full blur-3xl p-10"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Info Column */}
                <div className="md:col-span-4 space-y-6">
                    <Card className="shadow-sm hover:shadow-md transition-shadow border-primary/10 bg-gradient-to-b from-card to-card/50">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 mb-1">
                                <Cpu className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance</h3>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-secondary/50 border">
                                    <div className="text-xs text-muted-foreground mb-1">Latency</div>
                                    <div className="text-2xl font-bold font-mono tracking-tight text-primary">
                                        {latestMetric ? latestMetric.heartbeat_latency_ms : "-"}
                                        <span className="text-sm text-muted-foreground font-normal ml-1">ms</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-secondary/50 border">
                                    <div className="text-xs text-muted-foreground mb-1">Connections</div>
                                    <div className="text-2xl font-bold font-mono tracking-tight">
                                        {latestMetric ? latestMetric.active_connections : "-"}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-l-4 border-l-primary/50">
                        <CardHeader>
                            <CardTitle className="text-lg">Network Identity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">ID</span>
                                <span className="font-mono">{agent.id}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">Public Key</span>
                                <span className="font-mono text-xs truncate max-w-[120px] bg-secondary px-2 py-1 rounded" title={agent.public_key}>
                                    {agent.public_key?.substring(0, 16) || "Not set"}...
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">Last Seen</span>
                                <span>{agent.last_seen ? new Date(agent.last_seen).toLocaleTimeString() : "Never"}</span>
                            </div>
                            <div className="pt-2">
                                <span className="text-muted-foreground block mb-2">Description</span>
                                <p className="text-sm leading-relaxed">
                                    {agent.description || "No description provided."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs Column */}
                <div className="md:col-span-8">
                    <Tabs defaultValue="overview" className="space-y-6">
                        <TabsList className="w-full justify-start overflow-x-auto border-b rounded-none h-auto p-0 bg-transparent gap-2 no-scrollbar">
                            <TabsTrigger
                                value="overview"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-base font-medium transition-colors hover:text-primary/70"
                            >
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="services"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-base font-medium transition-colors hover:text-primary/70"
                            >
                                Services
                            </TabsTrigger>
                            <TabsTrigger
                                value="policies"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-base font-medium transition-colors hover:text-primary/70"
                            >
                                Policies
                                <Badge className="ml-2 h-5 px-1.5 rounded-full bg-primary/10 text-primary border-0" variant="secondary">{inbound.length + outbound.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="routes"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-base font-medium transition-colors hover:text-primary/70"
                            >
                                Routes
                            </TabsTrigger>
                            <TabsTrigger
                                value="logs"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-base font-medium transition-colors hover:text-primary/70"
                            >
                                Logs
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-6 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-t-4 border-t-emerald-500/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Zap className="h-4 w-4" /> Traffic Throughput
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-baseline gap-2">
                                            <div className="text-3xl font-bold tracking-tighter">
                                                {latestMetric ? ((latestMetric.bytes_sent + latestMetric.bytes_received) / 1024 / 1024).toFixed(2) : "0.00"}
                                            </div>
                                            <span className="text-sm font-medium text-muted-foreground">MB Total</span>
                                        </div>
                                        <div className="mt-6 flex items-center justify-between text-sm py-3 px-4 bg-secondary/30 rounded-lg">
                                            <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                                <ArrowUp className="w-4 h-4 mr-1.5" />
                                                {(latestMetric?.bytes_sent || 0 / 1024 / 1024).toFixed(2)} MB Tx
                                            </div>
                                            <div className="w-[1px] h-4 bg-border"></div>
                                            <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                                                <ArrowDown className="w-4 h-4 mr-1.5" />
                                                {(latestMetric?.bytes_received || 0 / 1024 / 1024).toFixed(2)} MB Rx
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Activity className="h-4 w-4" /> Live Activity
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {accessLogs.slice(0, 3).map((log) => (
                                                <div key={log.id} className="flex items-center justify-between text-sm bg-muted/20 p-2 rounded-md hover:bg-muted/40 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-2 h-2 rounded-full ring-2 ring-offset-1 ring-offset-background", log.action === "allowed" ? "bg-green-500 ring-green-500/30" : "bg-red-500 ring-red-500/30")} />
                                                        <span className="truncate font-medium">{log.service?.name || `Port ${log.port}`}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                </div>
                                            ))}
                                            {accessLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No recent activity detected.</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Services Tab */}
                        <TabsContent value="services" className="pt-2">
                            <Card className="border-t-4 border-t-purple-500/50">
                                <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
                                    <div>
                                        <CardTitle>Exposed Services</CardTitle>
                                        <CardDescription>Services available to authenticated agents</CardDescription>
                                    </div>
                                    <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="shadow-sm">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Service
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add Service</DialogTitle>
                                                <DialogDescription>
                                                    Expose a local service to the mesh.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Service Name</Label>
                                                    <Input
                                                        placeholder="e.g., Database"
                                                        value={newService.name}
                                                        onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label>Port</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="80"
                                                            value={newService.port}
                                                            onChange={(e) => setNewService({ ...newService, port: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label>Protocol</Label>
                                                        <Select
                                                            value={newService.protocol}
                                                            onValueChange={(val) => setNewService({ ...newService, protocol: val })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="tcp">TCP</SelectItem>
                                                                <SelectItem value="udp">UDP</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Description</Label>
                                                    <Input
                                                        placeholder="Optional description"
                                                        value={newService.description}
                                                        onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCreateService}>Add Service</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {services.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                            <div className="bg-muted p-4 rounded-full mb-3">
                                                <Server className="h-6 w-6 opacity-40" />
                                            </div>
                                            <p className="font-medium">No services exposed</p>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-[300px]">Service</TableHead>
                                                    <TableHead>Protocol</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {services.map((service) => (
                                                    <TableRow key={service.id} className="group">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                                                                    <Server className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold">{service.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{service.description}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="font-mono text-xs">
                                                                    {service.port}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground uppercase">{service.protocol}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteService(service.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Policies Tab */}
                        <TabsContent value="policies" className="pt-2 space-y-6">
                            {!agent.group_id ? (
                                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 border-dashed border-2 shadow-none">
                                    <CardContent className="pt-6 flex flex-col items-center justify-center text-center">
                                        <Shield className="h-10 w-10 text-yellow-600 mb-3 opacity-80" />
                                        <h3 className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">Policy Enforcement Disabled</h3>
                                        <p className="text-yellow-700 dark:text-yellow-300 text-sm max-w-md mb-4">
                                            This agent belongs to no group, so security policies cannot be applied.
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="border-yellow-300 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200"
                                            onClick={() => setEditDialogOpen(true)}
                                        >
                                            Assign to Group
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                Inbound Rules
                                            </CardTitle>
                                            <CardDescription>Who can access this agent</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {inbound.length === 0 ? (
                                                <div className="text-sm text-muted-foreground italic p-4 text-center bg-muted/20 rounded-lg">No inbound policies active.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {inbound.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("p-2 rounded-full bg-opacity-10", p.action === "allow" ? "bg-green-500 text-green-500" : "bg-red-500 text-red-500")}>
                                                                    {p.action === "allow" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium flex items-center gap-2">
                                                                        <span className={cn(p.action === "allow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400 capitalize")}>
                                                                            {p.action}
                                                                        </span>
                                                                        <span>access from</span>
                                                                        <Badge variant="outline" className="text-sm">{p.source_group?.name || "Unknown"}</Badge>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                        Ports: {p.allowed_ports}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href="/policies" className="text-xs">View</Link>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                                Outbound Rules
                                            </CardTitle>
                                            <CardDescription>Who this agent can access</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {outbound.length === 0 ? (
                                                <div className="text-sm text-muted-foreground italic p-4 text-center bg-muted/20 rounded-lg">No outbound policies active.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {outbound.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("p-2 rounded-full bg-opacity-10", p.action === "allow" ? "bg-green-500 text-green-500" : "bg-red-500 text-red-500")}>
                                                                    {p.action === "allow" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium flex items-center gap-2">
                                                                        <span className={cn(p.action === "allow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400 capitalize")}>
                                                                            {p.action}
                                                                        </span>
                                                                        <span>access to</span>
                                                                        <Badge variant="outline" className="text-sm">{p.dest_group?.name || "Unknown"}</Badge>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                        Ports: {p.allowed_ports}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href="/policies" className="text-xs">View</Link>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                        {/* Routes Tab */}
                        <TabsContent value="routes" className="pt-2">
                            <Card className="overflow-hidden">
                                <CardHeader className="bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        <div>
                                            <CardTitle>Advertised Routes</CardTitle>
                                            <CardDescription>Subnets reachable via this agent</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="flex gap-3">
                                        <div className="relative flex-1 max-w-sm">
                                            <Network className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="e.g. 192.168.1.0/24"
                                                value={newRoute}
                                                onChange={(e) => setNewRoute(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                        <Button onClick={handleAddRoute}>Add Route</Button>
                                    </div>
                                    <div className="grid gap-3">
                                        {routes.map((route) => (
                                            <div key={route} className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded text-blue-600">
                                                        <Network className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-mono text-sm font-medium">{route}</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveRoute(route)} className="hover:bg-destructive/10 hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {routes.length === 0 && <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">No advertised routes.</div>}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Logs Tab */}
                        <TabsContent value="logs" className="pt-2 space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">Access Logs</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                <TableRow>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Destination</TableHead>
                                                    <TableHead className="text-right">Timestamp</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {accessLogs.slice(0, 15).map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell>
                                                            <Badge variant={log.action === "allowed" ? "default" : "destructive"} className="uppercase text-[10px]">
                                                                {log.action}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{log.service?.name || "Direct Connection"}</div>
                                                            <div className="text-xs text-muted-foreground font-mono">Port {log.port}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                                            {new Date(log.created_at).toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {accessLogs.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                                            No logs found
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Agent</DialogTitle>
                        <DialogDescription>
                            Update basic details and group assignment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Input
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Group Assignment</Label>
                            <Select
                                value={editForm.group_id}
                                onValueChange={(val) => setEditForm({ ...editForm, group_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">
                                        <span className="text-muted-foreground">No Group (Unassigned)</span>
                                    </SelectItem>
                                    {groups.map(g => (
                                        <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleUpdateAgent}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Key Regeneration Dialog */}
            <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New API Key Generated</DialogTitle>
                        <DialogDescription>
                            Save this key securely - it won't be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted p-3 rounded text-sm font-mono break-all text-primary">
                                {showKey ? newApiKey : "•".repeat(32)}
                            </code>
                            <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(newApiKey)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Usage:</strong> <code>./agent --key {newApiKey}</code>
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => { setKeyDialogOpen(false); setNewApiKey(""); setShowKey(false); }}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

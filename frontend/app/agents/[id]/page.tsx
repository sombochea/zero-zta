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
    Network
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
                <Skeleton className="h-12 w-full" />
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/agents">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                            <div className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                agent.status === "online"
                                    ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900"
                                    : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700")}>
                                <div className={cn("w-1.5 h-1.5 rounded-full", agent.status === "online" ? "bg-green-500" : "bg-zinc-400")} />
                                {agent.status.toUpperCase()}
                            </div>
                        </div>
                        <p className="text-muted-foreground font-mono text-sm mt-1">{agent.ip}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Agent
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleRegenerateKey} title="Regenerate API Key">
                        <Key className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Info Column */}
                <div className="md:col-span-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Identity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Group Assignment</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    {agent.group ? (
                                        <Badge variant="outline" className="text-sm py-1">
                                            <Shield className="w-3 h-3 mr-1" />
                                            {agent.group.name}
                                        </Badge>
                                    ) : (
                                        <div className="text-sm text-yellow-600 flex items-center gap-1">
                                            <XCircle className="w-4 h-4" />
                                            No Group Assigned
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Agent ID</Label>
                                <p className="font-mono text-sm mt-1">{agent.id}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                                <p className="text-sm mt-1">{agent.description || "No description provided."}</p>
                            </div>
                            <div className="pt-2 border-t">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Metrics</Label>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <div className="text-2xl font-bold">{latestMetric ? `${latestMetric.heartbeat_latency_ms}ms` : "-"}</div>
                                        <div className="text-xs text-muted-foreground">Latency</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{latestMetric ? latestMetric.active_connections : "-"}</div>
                                        <div className="text-xs text-muted-foreground">Active Conns</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Connectivity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Last Seen</span>
                                <span>{agent.last_seen ? new Date(agent.last_seen).toLocaleString() : "Never"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Registered</span>
                                <span>{new Date(agent.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Public Key</span>
                                <span className="font-mono text-xs truncate max-w-[150px]" title={agent.public_key}>{agent.public_key || "Not set"}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs Column */}
                <div className="md:col-span-8">
                    <Tabs defaultValue="overview" className="space-y-4">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                            <TabsTrigger
                                value="overview"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
                            >
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="services"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
                            >
                                Services
                            </TabsTrigger>
                            <TabsTrigger
                                value="policies"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
                            >
                                Policies
                                <Badge className="ml-2 h-5 px-1.5 rounded-full" variant="secondary">{inbound.length + outbound.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="routes"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
                            >
                                Routes
                            </TabsTrigger>
                            <TabsTrigger
                                value="logs"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
                            >
                                Logs
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Throughput</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-baseline gap-2">
                                            <div className="text-2xl font-bold">
                                                {latestMetric ? (latestMetric.bytes_sent + latestMetric.bytes_received / 1024 / 1024).toFixed(2) : "0.00"}
                                            </div>
                                            <span className="text-sm text-muted-foreground">MB Total</span>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between text-xs">
                                            <div className="flex items-center text-blue-500">
                                                <ArrowUp className="w-3 h-3 mr-1" />
                                                {(latestMetric?.bytes_sent || 0 / 1024 / 1024).toFixed(2)} MB Sent
                                            </div>
                                            <div className="flex items-center text-green-500">
                                                <ArrowDown className="w-3 h-3 mr-1" />
                                                {(latestMetric?.bytes_received || 0 / 1024 / 1024).toFixed(2)} MB Recv
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {accessLogs.slice(0, 3).map((log) => (
                                                <div key={log.id} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-1.5 h-1.5 rounded-full", log.action === "allowed" ? "bg-green-500" : "bg-red-500")} />
                                                        <span className="truncate max-w-[100px]">{log.service?.name || `Port ${log.port}`}</span>
                                                    </div>
                                                    <span className="text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                </div>
                                            ))}
                                            {accessLogs.length === 0 && <p className="text-xs text-muted-foreground">No recent connections</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Services Tab */}
                        <TabsContent value="services" className="pt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Exposed Services</CardTitle>
                                        <CardDescription>Services available to authenticated agents</CardDescription>
                                    </div>
                                    <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm">
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
                                <CardContent>
                                    {services.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                            <Server className="h-8 w-8 opacity-20 mb-2" />
                                            <p>No services exposed</p>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Service</TableHead>
                                                    <TableHead>Details</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {services.map((service) => (
                                                    <TableRow key={service.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{service.name}</div>
                                                            <div className="text-xs text-muted-foreground">{service.description}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {service.port}/{service.protocol}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}>
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
                        <TabsContent value="policies" className="pt-4 space-y-4">
                            {!agent.group_id ? (
                                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                            <Shield className="h-5 w-5" />
                                            <p>No policies applied because this agent is not in a group.</p>
                                        </div>
                                        <Button
                                            variant="link"
                                            className="px-0 text-yellow-800 dark:text-yellow-200 underline"
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
                                            <CardTitle className="text-base">Inbound Policies</CardTitle>
                                            <CardDescription>Who can access this agent</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {inbound.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No inbound policies.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {inbound.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/40 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                {p.action === "allow" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                                <span className="font-medium">{p.source_group?.name || "Unknown"}</span>
                                                                <span className="text-muted-foreground">can access</span>
                                                                <Badge variant="outline">{p.allowed_ports}</Badge>
                                                            </div>
                                                            <Link href="/policies" className="text-xs text-blue-500 hover:underline">View</Link>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Outbound Policies</CardTitle>
                                            <CardDescription>Who this agent can access</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {outbound.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No outbound policies.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {outbound.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/40 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                {p.action === "allow" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                                <span className="text-muted-foreground">Can access</span>
                                                                <span className="font-medium">{p.dest_group?.name || "Unknown"}</span>
                                                                <Badge variant="outline">{p.allowed_ports}</Badge>
                                                            </div>
                                                            <Link href="/policies" className="text-xs text-blue-500 hover:underline">View</Link>
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
                        <TabsContent value="routes" className="pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Advertised Routes</CardTitle>
                                    <CardDescription>Subnets reachable via this agent</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. 192.168.1.0/24"
                                            value={newRoute}
                                            onChange={(e) => setNewRoute(e.target.value)}
                                            className="max-w-xs"
                                        />
                                        <Button onClick={handleAddRoute}>Add</Button>
                                    </div>
                                    <div className="space-y-2">
                                        {routes.map((route) => (
                                            <div key={route} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Network className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-mono text-sm">{route}</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveRoute(route)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        {routes.length === 0 && <p className="text-sm text-muted-foreground">No routes advertised available.</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Logs Tab */}
                        <TabsContent value="logs" className="pt-4 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Access Logs</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {accessLogs.slice(0, 10).map((log) => (
                                            <div key={log.id} className="flex items-center justify-between p-2 border-b text-sm last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={log.action === "allowed" ? "default" : "destructive"}>
                                                        {log.action}
                                                    </Badge>
                                                    <div>
                                                        <span className="font-medium">{log.service?.name || "Direct"}</span>
                                                        <span className="text-muted-foreground ml-2">:{log.port}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                        {accessLogs.length === 0 && <p className="text-sm text-muted-foreground">No access logs.</p>}
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
                            <code className="flex-1 bg-muted p-3 rounded text-sm font-mono break-all">
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

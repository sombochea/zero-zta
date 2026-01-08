"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    Activity,
    Edit,
    ArrowUp,
    ArrowDown,
    Shield,
    CheckCircle2,
    XCircle,
    Server,
    Network,
    Cpu,
    Zap,
    Globe,
    LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export default function AgentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const agentId = Number(params.id);

    const [agent, setAgent] = useState<Agent | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
    const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState("overview");

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
            setGroups(groupsData);
            setMetrics(metricsData);
            setAccessLogs(accessLogsData);
            setPolicies(policiesData);

            setEditForm({
                name: agentData.name,
                description: agentData.description || "",
                group_id: agentData.group_id ? String(agentData.group_id) : "0"
            });

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
            toast.success("Service added");
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
        if (!confirm("This will invalidate the current API key. The agent will need to reconnect. Continue?")) return;
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
            toast.error("Invalid CIDR format");
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
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        );
    }

    if (!agent) {
        return <div className="p-8 text-center text-muted-foreground">Agent not found</div>;
    }

    const latestMetric = metrics.length > 0 ? metrics[0] : null;
    const { inbound, outbound } = getEffectivePolicies();
    const policyCount = inbound.length + outbound.length;

    const tabs = [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "services", label: "Services", icon: Server },
        { id: "policies", label: "Policies", icon: Shield, badge: policyCount > 0 ? policyCount : null },
        { id: "routes", label: "Routes", icon: Network },
        { id: "logs", label: "Logs", icon: Activity },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/agents">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-background border-2 hover:bg-muted/50">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                        <div className="flex items-center gap-3 text-muted-foreground mt-1 text-sm font-medium">
                            <span className={cn("flex items-center gap-1.5", agent.status === "online" ? "text-green-500" : "text-zinc-500")}>
                                <div className={cn("w-2 h-2 rounded-full", agent.status === "online" ? "bg-green-500" : "bg-zinc-400")} />
                                {agent.status.toUpperCase()}
                            </span>
                            <span>•</span>
                            <span className="font-mono">{agent.ip}</span>
                            <span>•</span>
                            <span>{agent.version || "v0.0.1"}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(true)} className="gap-2">
                        <Edit className="h-4 w-4" /> Edit
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleRegenerateKey}>
                        <Key className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Custom Horizontal Tabs */}
            <div className="border-b border-border/60">
                <div className="flex items-center gap-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium relative transition-colors bg-transparent border-0 hover:text-primary/80",
                                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            {tab.badge && (
                                <Badge variant="secondary" className="px-1.5 h-5 min-w-5 text-[10px] bg-primary/10 text-primary hover:bg-primary/20">{tab.badge}</Badge>
                            )}
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === "overview" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Stats Cards */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" /> Live Metrics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                                    <div className="text-sm text-muted-foreground mb-1">Latency</div>
                                    <div className="text-2xl font-bold font-mono text-primary">
                                        {latestMetric?.heartbeat_latency_ms || "-"} <span className="text-sm text-muted-foreground font-sans font-normal">ms</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                                    <div className="text-sm text-muted-foreground mb-1">Connections</div>
                                    <div className="text-2xl font-bold font-mono">
                                        {latestMetric?.active_connections || "0"}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                                    <div className="text-sm text-muted-foreground mb-1">Data Transfer</div>
                                    <div className="text-xl font-bold font-mono">
                                        {latestMetric ? ((latestMetric.bytes_sent + latestMetric.bytes_received) / 1024 / 1024).toFixed(1) : "0"} <span className="text-sm text-muted-foreground font-normal">MB</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-lg">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Assigned Group</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        {agent.group ? (
                                            <Badge variant="outline" className="py-1 px-3 bg-primary/5 border-primary/20 text-primary">
                                                <Shield className="w-3 h-3 mr-1.5" />
                                                {agent.group.name}
                                            </Badge>
                                        ) : (
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <XCircle className="w-4 h-4" /> Unassigned
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Public Key</Label>
                                    <code className="block mt-1 text-xs bg-muted p-2 rounded truncate">
                                        {agent.public_key}
                                    </code>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Description</Label>
                                    <p className="text-sm mt-1 text-muted-foreground leading-relaxed">
                                        {agent.description || "No description provided."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === "services" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold">Exposed Services</h2>
                                <p className="text-muted-foreground text-sm">Manage services exposed by this agent to the mesh.</p>
                            </div>
                            <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button><Plus className="mr-2 h-4 w-4" /> Add Service</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Service</DialogTitle>
                                        <DialogDescription>Expose a local port on this agent.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Name</Label>
                                            <Input value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} placeholder="Web Server" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label>Port</Label>
                                                <Input type="number" value={newService.port} onChange={e => setNewService({ ...newService, port: e.target.value })} placeholder="80" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Protocol</Label>
                                                <Select value={newService.protocol} onValueChange={v => setNewService({ ...newService, protocol: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="tcp">TCP</SelectItem>
                                                        <SelectItem value="udp">UDP</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Description</Label>
                                            <Input value={newService.description} onChange={e => setNewService({ ...newService, description: e.target.value })} placeholder="Optional" />
                                        </div>
                                    </div>
                                    <DialogFooter><Button onClick={handleCreateService}>Add Service</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Service Name</TableHead>
                                            <TableHead>Port/Protocol</TableHead>
                                            <TableHead>Test Access</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {services.map(svc => (
                                            <TableRow key={svc.id}>
                                                <TableCell>
                                                    <div className="font-medium">{svc.name}</div>
                                                    <div className="text-xs text-muted-foreground">{svc.description}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono">{svc.port}/{svc.protocol}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {svc.protocol === 'tcp' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-2"
                                                            onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/debug/proxy?ip=${agent.ip}&port=${svc.port}`, '_blank')}
                                                        >
                                                            <Globe className="h-3.5 w-3.5" /> Proxy Open
                                                        </Button>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteService(svc.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {services.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No services configured</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === "policies" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {!agent.group_id ? (
                            <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl bg-muted/20">
                                <Shield className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="font-semibold text-lg">No Policies Applied</h3>
                                <p className="text-muted-foreground mb-4">Assign this agent to a group to apply security policies.</p>
                                <Button variant="outline" onClick={() => setEditDialogOpen(true)}>Assign Group</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-base text-green-600 dark:text-green-400">Inbound (Ingress)</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {inbound.length === 0 && <p className="text-sm text-muted-foreground">No inbound rules.</p>}
                                        {inbound.map(p => (
                                            <div key={p.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                                                {p.action === 'allow' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                <div className="text-sm">
                                                    <span className="font-semibold">{p.source_group?.name}</span> <span className="text-muted-foreground">can access ports</span> <span className="font-mono">{p.allowed_ports}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle className="text-base text-blue-600 dark:text-blue-400">Outbound (Egress)</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {outbound.length === 0 && <p className="text-sm text-muted-foreground">No outbound rules.</p>}
                                        {outbound.map(p => (
                                            <div key={p.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                                                {p.action === 'allow' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">Can access</span> <span className="font-semibold">{p.dest_group?.name}</span> <span className="text-muted-foreground">on ports</span> <span className="font-mono">{p.allowed_ports}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === "routes" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Advertised Routes</CardTitle>
                                    <CardDescription>Subnets directed to this agent.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input value={newRoute} onChange={e => setNewRoute(e.target.value)} placeholder="192.168.1.0/24" className="max-w-xs" />
                                    <Button onClick={handleAddRoute}>Add Route</Button>
                                </div>
                                <div className="grid gap-2">
                                    {routes.map(r => (
                                        <div key={r} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                <Network className="h-4 w-4 text-blue-500" />
                                                <span className="font-mono text-sm">{r}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRoute(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    ))}
                                    {routes.length === 0 && <p className="text-sm text-muted-foreground py-4">No advertised routes.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === "logs" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead className="text-right">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accessLogs.slice(0, 20).map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    <Badge variant={log.action === "allowed" ? "default" : "destructive"} className="uppercase text-[10px]">
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{log.service?.name || "Direct"}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">Port {log.port}</div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Agent</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Group Assignment</Label>
                            <Select value={editForm.group_id} onValueChange={(val) => setEditForm({ ...editForm, group_id: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Unassigned</SelectItem>
                                    {groups.map(g => (<SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleUpdateAgent}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Key Dialog */}
            <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>New API Key</DialogTitle></DialogHeader>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted p-3 rounded text-sm font-mono break-all text-primary">{showKey ? newApiKey : "•".repeat(32)}</code>
                        <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(newApiKey)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <DialogFooter><Button onClick={() => setKeyDialogOpen(false)}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

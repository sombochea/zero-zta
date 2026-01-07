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
    assignAgentGroup,
    getGroups,
    getAgentMetrics,
    getAgentAccessLogs,
    Agent,
    Service,
    AuditLog,
    Group,
    AgentMetrics,
    AccessLog
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
    ArrowDown
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
            const [agentData, servicesData, logsData, groupsData, metricsData, accessLogsData] = await Promise.all([
                getAgent(agentId),
                getAgentServices(agentId),
                getAgentAuditLogs(agentId),
                getGroups(),
                getAgentMetrics(agentId),
                getAgentAccessLogs(agentId)
            ]);
            setAgent(agentData);
            setServices(servicesData);
            setAuditLogs(logsData);
            setGroups(groupsData);
            setMetrics(metricsData);
            setAccessLogs(accessLogsData);

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

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!agent) {
        return <div>Agent not found</div>;
    }

    const latestMetric = metrics.length > 0 ? metrics[0] : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/agents">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{agent.name}</h1>
                            <Badge variant={agent.status === "online" ? "default" : "secondary"}>
                                {agent.status}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditDialogOpen(true)}>
                                <Edit className="h-3 w-3 text-muted-foreground" />
                            </Button>
                        </div>
                        <p className="text-muted-foreground font-mono text-sm">{agent.ip}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRegenerateKey}>
                        <Key className="mr-2 h-4 w-4" />
                        Regenerate Key
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{latestMetric ? `${latestMetric.heartbeat_latency_ms}ms` : "-"}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Conn.</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{latestMetric ? latestMetric.active_connections : "-"}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Data Sent</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{latestMetric ? `${(latestMetric.bytes_sent / 1024 / 1024).toFixed(1)} MB` : "-"}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Data Recv</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{latestMetric ? `${(latestMetric.bytes_received / 1024 / 1024).toFixed(1)} MB` : "-"}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="services" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="services" className="gap-2"><Server className="h-4 w-4" /> Services</TabsTrigger>
                    <TabsTrigger value="routes" className="gap-2"><Router className="h-4 w-4" /> Routes</TabsTrigger>
                    <TabsTrigger value="metrics" className="gap-2"><BarChart3 className="h-4 w-4" /> Metrics</TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2"><Activity className="h-4 w-4" /> Logs</TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" /> Settings</TabsTrigger>
                </TabsList>

                {/* Services Tab */}
                <TabsContent value="services">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Exposed Services</CardTitle>
                                <CardDescription>Services that other agents can access</CardDescription>
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
                                            Expose a local service for other agents to access.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Service Name</Label>
                                            <Input
                                                placeholder="e.g., MySQL, Redis, PostgreSQL"
                                                value={newService.name}
                                                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label>Port</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="3306"
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
                                            <Label>Description (optional)</Label>
                                            <Input
                                                placeholder="Production database server"
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
                                <div className="text-center py-8 text-muted-foreground">
                                    No services configured. Add a service to share it with other agents.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Port</TableHead>
                                            <TableHead>Protocol</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {services.map((service) => (
                                            <TableRow key={service.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{service.name}</p>
                                                        {service.description && (
                                                            <p className="text-sm text-muted-foreground">{service.description}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono">{service.port}</TableCell>
                                                <TableCell className="uppercase">{service.protocol}</TableCell>
                                                <TableCell>
                                                    <Badge variant={service.enabled ? "default" : "secondary"}>
                                                        {service.enabled ? "Active" : "Disabled"}
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

                {/* Routes Tab */}
                <TabsContent value="routes">
                    <Card>
                        <CardHeader>
                            <CardTitle>Network Routes</CardTitle>
                            <CardDescription>Local subnets that this agent can route traffic to</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="192.168.1.0/24"
                                    value={newRoute}
                                    onChange={(e) => setNewRoute(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddRoute()}
                                />
                                <Button onClick={handleAddRoute}>Add Route</Button>
                            </div>

                            {routes.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No routes configured. Add a route to expose local subnets.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {routes.map((route) => (
                                        <div key={route} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                            <span className="font-mono">{route}</span>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRoute(route)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics">
                    <div className="grid gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Traffic History</CardTitle>
                                <CardDescription>Incoming and outgoing data</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {metrics.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No metrics data available yet.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Simple visualization list since we don't have recharts */}
                                        <div className="space-y-2">
                                            {metrics.slice(0, 5).map((m, i) => (
                                                <div key={m.id} className="flex items-center justify-between text-sm p-2 border-b">
                                                    <span className="text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</span>
                                                    <div className="flex gap-4">
                                                        <span className="flex items-center text-blue-500"><ArrowUp className="h-3 w-3 mr-1" /> {(m.bytes_sent / 1024).toFixed(1)} KB</span>
                                                        <span className="flex items-center text-green-500"><ArrowDown className="h-3 w-3 mr-1" /> {(m.bytes_received / 1024).toFixed(1)} KB</span>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <span>Conn: {m.active_connections}</span>
                                                        <span>Latency: {m.heartbeat_latency_ms}ms</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Access Logs</CardTitle>
                                <CardDescription>Inter-agent connection attempts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {accessLogs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No access logs available.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {accessLogs.map((log) => (
                                            <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={log.action === "allowed" ? "default" : "destructive"}>
                                                        {log.action}
                                                    </Badge>
                                                    <span>
                                                        {log.source_agent?.name || `Agent ${log.source_agent_id}`}
                                                        <span className="text-muted-foreground mx-1">→</span>
                                                        {log.service?.name ? `${log.service.name} (${log.port})` : `Port ${log.port}`}
                                                    </span>
                                                </div>
                                                <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Audit Logs</CardTitle>
                                <CardDescription>Administrative activity</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {auditLogs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No activity recorded yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {auditLogs.map((log) => (
                                            <div key={log.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                                                <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium">{log.action.replace(/_/g, ' ')}</p>
                                                    <p className="text-sm text-muted-foreground truncate">{log.details}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(log.created_at).toLocaleString()}
                                                        {log.ip_address && ` • ${log.ip_address}`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Settings</CardTitle>
                            <CardDescription>Configuration and details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4">
                                <div>
                                    <Label>Agent ID</Label>
                                    <p className="text-sm font-mono">{agent.id}</p>
                                </div>
                                <div>
                                    <Label>IP Address</Label>
                                    <p className="text-sm font-mono">{agent.ip}</p>
                                </div>
                                <div>
                                    <Label>Group</Label>
                                    <p className="text-sm">{agent.group?.name || "No group assigned"}</p>
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <p className="text-sm">{agent.description || "No description"}</p>
                                </div>
                                <div>
                                    <Label>Last Seen</Label>
                                    <p className="text-sm">{agent.last_seen ? new Date(agent.last_seen).toLocaleString() : "Never"}</p>
                                </div>
                                <div>
                                    <Label>Created</Label>
                                    <p className="text-sm">{new Date(agent.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Agent</DialogTitle>
                        <DialogDescription>
                            Update agent details and group assignment.
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
                            <Label>Group</Label>
                            <Select
                                value={editForm.group_id}
                                onValueChange={(val) => setEditForm({ ...editForm, group_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">No Group</SelectItem>
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

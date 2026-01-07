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
    getAgent,
    getAgentServices,
    getAgentAuditLogs,
    createService,
    deleteService,
    regenerateAgentKey,
    updateAgentRoutes,
    Agent,
    Service,
    AuditLog
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
    Server
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function AgentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const agentId = Number(params.id);

    const [agent, setAgent] = useState<Agent | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [keyDialogOpen, setKeyDialogOpen] = useState(false);
    const [newApiKey, setNewApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);

    // Form states
    const [newService, setNewService] = useState({ name: "", port: "", protocol: "tcp", description: "" });
    const [routes, setRoutes] = useState<string[]>([]);
    const [newRoute, setNewRoute] = useState("");

    const fetchData = async () => {
        try {
            const [agentData, servicesData, logsData] = await Promise.all([
                getAgent(agentId),
                getAgentServices(agentId),
                getAgentAuditLogs(agentId),
            ]);
            setAgent(agentData);
            setServices(servicesData);
            setAuditLogs(logsData);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/agents">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{agent.name}</h1>
                        <Badge variant={agent.status === "online" ? "default" : "secondary"}>
                            {agent.status}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground font-mono">{agent.ip}</p>
                </div>
                <Button variant="outline" onClick={handleRegenerateKey}>
                    <Key className="mr-2 h-4 w-4" />
                    Regenerate Key
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="services" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="services" className="gap-2">
                        <Server className="h-4 w-4" />
                        Services
                    </TabsTrigger>
                    <TabsTrigger value="routes" className="gap-2">
                        <Router className="h-4 w-4" />
                        Routes
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Logs
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <Settings2 className="h-4 w-4" />
                        Settings
                    </TabsTrigger>
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
                                                <select
                                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                                    value={newService.protocol}
                                                    onChange={(e) => setNewService({ ...newService, protocol: e.target.value })}
                                                >
                                                    <option value="tcp">TCP</option>
                                                    <option value="udp">UDP</option>
                                                </select>
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

                {/* Logs Tab */}
                <TabsContent value="logs">
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Logs</CardTitle>
                            <CardDescription>Recent activity for this agent</CardDescription>
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

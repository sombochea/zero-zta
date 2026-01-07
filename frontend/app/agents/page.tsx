"use client";

import { useEffect, useState } from "react";
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
import { getAgents, createAgent, deleteAgent, Agent } from "@/lib/api";
import { Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAgentName, setNewAgentName] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);

    const fetchAgents = async () => {
        try {
            const data = await getAgents();
            setAgents(data);
        } catch (error) {
            console.error("Failed to fetch agents:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleCreate = async () => {
        if (!newAgentName.trim()) return;

        try {
            const agent = await createAgent({ name: newAgentName });
            setCreatedAgent(agent);
            setNewAgentName("");
            fetchAgents();
        } catch (error) {
            console.error("Failed to create agent:", error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this agent?")) return;

        try {
            await deleteAgent(id);
            fetchAgents();
        } catch (error) {
            console.error("Failed to delete agent:", error);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
                    <p className="text-muted-foreground">
                        Manage network agents and their credentials
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setCreatedAgent(null); setDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {createdAgent ? "Agent Created" : "Create New Agent"}
                            </DialogTitle>
                            <DialogDescription>
                                {createdAgent
                                    ? "Your agent has been created. Save the API key securely - it won't be shown again."
                                    : "Enter a name for the new agent."
                                }
                            </DialogDescription>
                        </DialogHeader>

                        {createdAgent ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Name</label>
                                    <p className="text-lg">{createdAgent.name}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">IP Address</label>
                                    <p className="text-lg font-mono">{createdAgent.ip}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">API Key</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">
                                            {showApiKey ? createdAgent.api_key : "•".repeat(32)}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => copyToClipboard(createdAgent.api_key || "")}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Usage:</strong> <code>./agent --key {createdAgent.api_key}</code>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Agent Name</label>
                                    <Input
                                        placeholder="e.g., web-server-1"
                                        value={newAgentName}
                                        onChange={(e) => setNewAgentName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                    />
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            {createdAgent ? (
                                <Button onClick={() => { setDialogOpen(false); setCreatedAgent(null); setShowApiKey(false); }}>
                                    Done
                                </Button>
                            ) : (
                                <Button onClick={handleCreate} disabled={!newAgentName.trim()}>
                                    Create Agent
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Agents</CardTitle>
                    <CardDescription>
                        {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {agents.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No agents registered yet. Click "New Agent" to create one.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Group</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.map((agent) => (
                                    <TableRow key={agent.id}>
                                        <TableCell className="font-medium">{agent.name}</TableCell>
                                        <TableCell className="font-mono">{agent.ip}</TableCell>
                                        <TableCell>
                                            <Badge variant={agent.status === 'online' ? 'default' : 'secondary'}>
                                                {agent.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {agent.group ? (
                                                <Badge variant="outline">{agent.group.name}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {agent.last_seen
                                                ? new Date(agent.last_seen).toLocaleString()
                                                : "Never"
                                            }
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(agent.id)}
                                            >
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
        </div>
    );
}

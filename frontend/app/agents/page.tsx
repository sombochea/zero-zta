"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getAgents, createAgent, deleteAgent, Agent } from "@/lib/api";
import { Plus, Trash2, Copy, Eye, EyeOff, ExternalLink, Server, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

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
            toast.error("Failed to fetch agents");
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
            toast.success("Agent created successfully");
            fetchAgents();
        } catch (error) {
            toast.error("Failed to create agent");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this agent?")) return;

        try {
            await deleteAgent(id);
            toast.success("Agent deleted");
            fetchAgents();
        } catch (error) {
            toast.error("Failed to delete agent");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const columns: ColumnDef<Agent>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => (
                <Link href={`/agents/${row.original.id}`} className="font-medium hover:underline flex items-center gap-2">
                    {row.getValue("name")}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
            ),
        },
        {
            accessorKey: "ip",
            header: "IP Address",
            cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("ip")}</span>,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge
                        variant={status === 'online' ? 'default' : 'secondary'}
                        className={status === 'online' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                    >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {status}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "group.name",
            header: "Group",
            cell: ({ row }) => {
                const groupName = row.original.group?.name;
                return groupName ? <Badge variant="outline">{groupName}</Badge> : <span className="text-muted-foreground">—</span>;
            },
        },
        {
            accessorKey: "last_seen",
            header: "Last Seen",
            cell: ({ row }) => {
                const lastSeen = row.getValue("last_seen") as string;
                return <span className="text-muted-foreground text-sm">{lastSeen ? new Date(lastSeen).toLocaleString() : "Never"}</span>;
            },
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/agents/${row.original.id}`}>
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
                    <p className="text-muted-foreground">
                        Manage network agents and their credentials
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setCreatedAgent(null); setDialogOpen(true); }} className="shadow-lg">
                            <Plus className="mr-2 h-4 w-4" />
                            New Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {createdAgent ? "Agent Created" : "Create New Agent"}
                            </DialogTitle>
                            <DialogDescription>
                                {createdAgent
                                    ? "Your agent has been created. Save the API key securely."
                                    : "Enter a name for the new agent."
                                }
                            </DialogDescription>
                        </DialogHeader>

                        {createdAgent ? (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <p className="text-sm font-medium">Name</p>
                                    <p className="text-lg">{createdAgent.name}</p>
                                </div>
                                <div className="grid gap-2">
                                    <p className="text-sm font-medium">IP Address</p>
                                    <p className="text-lg font-mono">{createdAgent.ip}</p>
                                </div>
                                <div className="grid gap-2">
                                    <p className="text-sm font-medium">API Key</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono break-all">
                                            {showApiKey ? createdAgent.api_key : "•".repeat(32)}
                                        </code>
                                        <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdAgent.api_key || "")}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Usage:</strong> <code className="break-all">./agent --key {createdAgent.api_key}</code>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <p className="text-sm font-medium">Agent Name</p>
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
                    <DataTable columns={columns} data={agents} filterColumn="name" filterPlaceholder="Filter agents..." />
                </CardContent>
            </Card>
        </div>
    );
}

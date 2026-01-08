"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLogs, AuditLog } from "@/lib/api";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

const actionColors: Record<string, string> = {
    connected: "bg-green-500/10 text-green-600 border-green-500/20",
    disconnected: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    key_regenerated: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    service_added: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    service_removed: "bg-red-500/10 text-red-600 border-red-500/20",
    routes_updated: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            const data = await getAuditLogs({ limit: 100 });
            setLogs(data);
        } catch (error) {
            toast.error("Failed to fetch audit logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const columns: ColumnDef<AuditLog>[] = [
        {
            accessorKey: "agent.name",
            header: "Agent",
            cell: ({ row }) => row.original.agent ? (
                <Link href={`/agents/${row.original.agent_id}`} className="font-medium hover:underline flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {row.original.agent.name}
                </Link>
            ) : <span className="text-muted-foreground flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"><Activity className="h-3 w-3 text-muted-foreground" /></div>System</span>,
        },
        {
            accessorKey: "action",
            header: "Action",
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={actionColors[row.getValue("action") as string] || ""}
                >
                    {(row.getValue("action") as string).replace(/_/g, ' ')}
                </Badge>
            ),
        },
        {
            accessorKey: "details",
            header: "Details",
            cell: ({ row }) => {
                let details: Record<string, any> = {};
                try {
                    details = JSON.parse(row.getValue("details"));
                } catch { }

                if (Object.keys(details).length === 0) return <span className="text-muted-foreground">—</span>;

                return (
                    <div className="text-xs text-muted-foreground space-x-2">
                        {Object.entries(details).slice(0, 3).map(([key, value]) => (
                            <span key={key} className="inline-flex items-center bg-muted/50 px-1.5 py-0.5 rounded">
                                <span className="font-semibold mr-1">{key}:</span>
                                <span className="font-mono max-w-[150px] truncate">
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            accessorKey: "created_at",
            header: "Time",
            cell: ({ row }) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(row.getValue("created_at")).toLocaleString()}</span>,
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Activity history across all agents
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Activity</CardTitle>
                    <CardDescription>{logs.length} events recorded</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={logs} filterColumn="agent.name" filterPlaceholder="Filter by agent..." />
                </CardContent>
            </Card>
        </div>
    );
}

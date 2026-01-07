"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { getAuditLogs, AuditLog } from "@/lib/api";
import { Activity, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
    const [search, setSearch] = useState("");

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

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.agent?.name?.toLowerCase().includes(search.toLowerCase())
    );

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
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>All Activity</CardTitle>
                        <CardDescription>{logs.length} events recorded</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <Activity className="h-12 w-12 mx-auto text-muted-foreground/50" />
                            <p className="mt-4 text-muted-foreground">
                                {search ? "No matching logs found" : "No activity recorded yet"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredLogs.map((log) => {
                                let details: Record<string, any> = {};
                                try {
                                    details = JSON.parse(log.details);
                                } catch { }

                                return (
                                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 bg-muted/30 rounded-xl border border-transparent hover:border-muted-foreground/10 transition-colors">
                                        <div className="flex items-center gap-3 sm:w-48 flex-shrink-0">
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                                <Activity className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {log.agent ? (
                                                    <Link href={`/agents/${log.agent_id}`} className="font-medium hover:underline truncate block">
                                                        {log.agent.name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground">System</span>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <Badge
                                                variant="outline"
                                                className={actionColors[log.action] || ""}
                                            >
                                                {log.action.replace(/_/g, ' ')}
                                            </Badge>

                                            {Object.keys(details).length > 0 && (
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    {Object.entries(details).map(([key, value]) => (
                                                        <span key={key} className="mr-4">
                                                            <span className="font-medium">{key}:</span>{' '}
                                                            <span className="font-mono text-xs">
                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-xs text-muted-foreground text-right hidden lg:block">
                                            {log.ip_address && <p>{log.ip_address}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

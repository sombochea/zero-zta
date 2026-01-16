"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLogs, AuditLog } from "@/lib/api";
import {
    Activity,
    Server,
    Shield,
    Network,
    Key,
    Plus,
    Minus,
    Clock,
    Search
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Input } from "@/components/ui/input";

const actionIcons: Record<string, any> = {
    connected: Activity,
    disconnected: Activity,
    key_regenerated: Key,
    service_added: Plus,
    service_removed: Minus,
    routes_updated: Network,
    policy_created: Shield,
    policy_updated: Shield,
    policy_deleted: Shield,
};

const actionColors: Record<string, string> = {
    connected: "bg-green-500 text-white",
    disconnected: "bg-gray-500 text-white",
    key_regenerated: "bg-yellow-500 text-white",
    service_added: "bg-blue-500 text-white",
    service_removed: "bg-red-500 text-white",
    routes_updated: "bg-purple-500 text-white",
    policy_created: "bg-green-600 text-white",
    policy_updated: "bg-blue-600 text-white",
    policy_deleted: "bg-red-600 text-white",
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

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
        log.agent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-8 w-8 text-primary" />
                        Audit Log
                    </h1>
                    <p className="text-muted-foreground">
                        Chronological history of network events and security actions
                    </p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search logs..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 bg-muted/30 rounded-xl relative z-10">
                        <p className="text-muted-foreground">No logs found matching your criteria.</p>
                    </div>
                ) : (
                    filteredLogs.map((log, index) => {
                        const Icon = actionIcons[log.action] || Activity;
                        const colorClass = actionColors[log.action] || "bg-gray-500 text-white";
                        const date = new Date(log.created_at);

                        let details = {};
                        try { details = JSON.parse(log.details); } catch { }

                        return (
                            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* Icon / Dot */}
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${colorClass} z-10`}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                {/* Card */}
                                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 hover:border-primary/50 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <Badge variant="outline" className="capitalize font-normal text-xs">
                                                {log.action.replace(/_/g, ' ')}
                                            </Badge>
                                            <time className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {date.toLocaleString()}
                                            </time>
                                        </div>

                                        <div className="font-semibold text-sm">
                                            {log.agent ? (
                                                <Link href={`/agents/${log.agent.id}`} className="hover:underline flex items-center gap-1">
                                                    <Server className="w-3 h-3" /> {log.agent.name}
                                                </Link>
                                            ) : "System"}
                                        </div>

                                        {Object.keys(details).length > 0 && (
                                            <div className="mt-2 text-xs bg-muted/50 p-2 rounded font-mono text-muted-foreground break-all">
                                                {Object.entries(details).map(([k, v]) => (
                                                    <div key={k}>
                                                        <span className="font-semibold text-foreground">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

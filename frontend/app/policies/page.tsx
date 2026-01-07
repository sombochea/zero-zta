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
import { getPolicies, createPolicy, deletePolicy, getGroups, Policy, Group } from "@/lib/api";
import { Plus, Trash2, ArrowRight } from "lucide-react";

export default function PoliciesPage() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Form state
    const [newPolicy, setNewPolicy] = useState({
        name: "",
        description: "",
        source_group_id: 0,
        dest_group_id: 0,
        allowed_ports: "*",
        action: "allow",
        enabled: true,
    });

    const fetchData = async () => {
        try {
            const [policiesData, groupsData] = await Promise.all([
                getPolicies(),
                getGroups(),
            ]);
            setPolicies(policiesData);
            setGroups(groupsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!newPolicy.name.trim() || !newPolicy.source_group_id || !newPolicy.dest_group_id) return;

        try {
            await createPolicy(newPolicy);
            setNewPolicy({
                name: "",
                description: "",
                source_group_id: 0,
                dest_group_id: 0,
                allowed_ports: "*",
                action: "allow",
                enabled: true,
            });
            setDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create policy:", error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this policy?")) return;

        try {
            await deletePolicy(id);
            fetchData();
        } catch (error) {
            console.error("Failed to delete policy:", error);
        }
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
                    <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
                    <p className="text-muted-foreground">
                        Define access control rules between groups
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={groups.length < 2}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Policy
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Policy</DialogTitle>
                            <DialogDescription>
                                Define which groups can communicate with each other.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Policy Name</label>
                                <Input
                                    placeholder="e.g., Allow Web to Database"
                                    value={newPolicy.name}
                                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Source Group</label>
                                    <select
                                        className="w-full mt-1 rounded-md border border-input bg-background p-2"
                                        value={newPolicy.source_group_id}
                                        onChange={(e) => setNewPolicy({ ...newPolicy, source_group_id: parseInt(e.target.value) })}
                                    >
                                        <option value={0}>Select group</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Destination Group</label>
                                    <select
                                        className="w-full mt-1 rounded-md border border-input bg-background p-2"
                                        value={newPolicy.dest_group_id}
                                        onChange={(e) => setNewPolicy({ ...newPolicy, dest_group_id: parseInt(e.target.value) })}
                                    >
                                        <option value={0}>Select group</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Allowed Ports</label>
                                <Input
                                    placeholder="e.g., 80,443,22 or * for all"
                                    value={newPolicy.allowed_ports}
                                    onChange={(e) => setNewPolicy({ ...newPolicy, allowed_ports: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Action</label>
                                <select
                                    className="w-full mt-1 rounded-md border border-input bg-background p-2"
                                    value={newPolicy.action}
                                    onChange={(e) => setNewPolicy({ ...newPolicy, action: e.target.value })}
                                >
                                    <option value="allow">Allow</option>
                                    <option value="deny">Deny</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={handleCreate}
                                disabled={!newPolicy.name.trim() || !newPolicy.source_group_id || !newPolicy.dest_group_id}
                            >
                                Create Policy
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {groups.length < 2 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <CardContent className="pt-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            You need at least 2 groups to create policies. Create groups first.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>All Policies</CardTitle>
                    <CardDescription>
                        {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} defined
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {policies.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No policies created yet. Create groups first, then add policies.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Rule</TableHead>
                                    <TableHead>Ports</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {policies.map((policy) => (
                                    <TableRow key={policy.id}>
                                        <TableCell className="font-medium">{policy.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{policy.source_group?.name}</Badge>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                <Badge variant="outline">{policy.dest_group?.name}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono">{policy.allowed_ports}</TableCell>
                                        <TableCell>
                                            <Badge variant={policy.action === "allow" ? "default" : "destructive"}>
                                                {policy.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={policy.enabled ? "default" : "secondary"}>
                                                {policy.enabled ? "Active" : "Disabled"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(policy.id)}
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

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { getPolicies, createPolicy, updatePolicy, deletePolicy, getGroups, getAgents, Policy, Group, Agent } from "@/lib/api";
import { Plus, Trash2, ArrowRight, Edit, Shield, ShieldCheck, ShieldX, Users } from "lucide-react";
import { toast } from "sonner";

export default function PoliciesPage() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

    // Form state
    const [formData, setFormData] = useState({
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
            const [policiesData, groupsData, agentsData] = await Promise.all([
                getPolicies(),
                getGroups(),
                getAgents(),
            ]);
            setPolicies(policiesData);
            setGroups(groupsData);
            setAgents(agentsData);
        } catch (error) {
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            source_group_id: 0,
            dest_group_id: 0,
            allowed_ports: "*",
            action: "allow",
            enabled: true,
        });
    };

    const handleCreate = async () => {
        if (!formData.name.trim() || !formData.source_group_id || !formData.dest_group_id) return;

        try {
            await createPolicy(formData);
            resetForm();
            setCreateDialogOpen(false);
            toast.success("Policy created successfully");
            fetchData();
        } catch (error) {
            toast.error("Failed to create policy");
        }
    };

    const handleUpdate = async () => {
        if (!selectedPolicy || !formData.name.trim()) return;

        try {
            await updatePolicy(selectedPolicy.id, formData);
            resetForm();
            setSelectedPolicy(null);
            setEditDialogOpen(false);
            toast.success("Policy updated successfully");
            fetchData();
        } catch (error) {
            toast.error("Failed to update policy");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this policy?")) return;

        try {
            await deletePolicy(id);
            toast.success("Policy deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete policy");
        }
    };

    const openEditDialog = (policy: Policy) => {
        setSelectedPolicy(policy);
        setFormData({
            name: policy.name,
            description: policy.description || "",
            source_group_id: policy.source_group_id,
            dest_group_id: policy.dest_group_id,
            allowed_ports: policy.allowed_ports,
            action: policy.action,
            enabled: policy.enabled,
        });
        setEditDialogOpen(true);
    };

    const togglePolicyEnabled = async (policy: Policy) => {
        try {
            await updatePolicy(policy.id, { enabled: !policy.enabled });
            toast.success(`Policy ${!policy.enabled ? "enabled" : "disabled"}`);
            fetchData();
        } catch (error) {
            toast.error("Failed to update policy");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const PolicyFormContent = () => (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input
                    placeholder="e.g., Allow Web to Database"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label>Description</Label>
                <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Source Group</Label>
                    <Select
                        value={String(formData.source_group_id)}
                        onValueChange={(v) => setFormData({ ...formData, source_group_id: parseInt(v) })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map(g => (
                                <SelectItem key={g.id} value={String(g.id)}>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        {g.name}
                                        <span className="text-xs text-muted-foreground">({g.agents?.length || 0})</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Destination Group</Label>
                    <Select
                        value={String(formData.dest_group_id)}
                        onValueChange={(v) => setFormData({ ...formData, dest_group_id: parseInt(v) })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map(g => (
                                <SelectItem key={g.id} value={String(g.id)}>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        {g.name}
                                        <span className="text-xs text-muted-foreground">({g.agents?.length || 0})</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Allowed Ports</Label>
                    <Input
                        placeholder="e.g., 80,443,22 or * for all"
                        value={formData.allowed_ports}
                        onChange={(e) => setFormData({ ...formData, allowed_ports: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                        value={formData.action}
                        onValueChange={(v) => setFormData({ ...formData, action: v })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="allow">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                    Allow
                                </div>
                            </SelectItem>
                            <SelectItem value="deny">
                                <div className="flex items-center gap-2">
                                    <ShieldX className="h-4 w-4 text-red-500" />
                                    Deny
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Enable Policy</Label>
                    <p className="text-sm text-muted-foreground">
                        Policy will be actively enforced
                    </p>
                </div>
                <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        Access Policies
                    </h1>
                    <p className="text-muted-foreground">
                        Define access control rules between agent groups
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} disabled={groups.length < 1}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Policy
                </Button>
            </div>

            {groups.length < 1 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <CardContent className="pt-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            You need at least 1 group to create policies. Create groups first.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Policies</CardDescription>
                        <CardTitle className="text-3xl">{policies.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active Policies</CardDescription>
                        <CardTitle className="text-3xl text-green-600">
                            {policies.filter(p => p.enabled).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Disabled Policies</CardDescription>
                        <CardTitle className="text-3xl text-muted-foreground">
                            {policies.filter(p => !p.enabled).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Policies</CardTitle>
                    <CardDescription>
                        {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} defined
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {policies.length === 0 ? (
                        <div className="text-center py-12">
                            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">
                                No policies created yet. Create groups first, then add policies.
                            </p>
                        </div>
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
                                    <TableRow key={policy.id} className={!policy.enabled ? "opacity-50" : ""}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{policy.name}</p>
                                                {policy.description && (
                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {policy.description}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-normal">
                                                    {policy.source_group?.name || "Unknown"}
                                                </Badge>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                <Badge variant="outline" className="font-normal">
                                                    {policy.dest_group?.name || "Unknown"}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {policy.allowed_ports}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={policy.action === "allow" ? "default" : "destructive"}>
                                                {policy.action === "allow" ? (
                                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                                ) : (
                                                    <ShieldX className="h-3 w-3 mr-1" />
                                                )}
                                                {policy.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={policy.enabled}
                                                onCheckedChange={() => togglePolicyEnabled(policy)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(policy)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(policy.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create New Policy</DialogTitle>
                        <DialogDescription>
                            Define which groups can communicate with each other.
                        </DialogDescription>
                    </DialogHeader>
                    <PolicyFormContent />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!formData.name.trim() || !formData.source_group_id || !formData.dest_group_id}
                        >
                            Create Policy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Policy</DialogTitle>
                        <DialogDescription>
                            Update the policy configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <PolicyFormContent />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={!formData.name.trim() || !formData.source_group_id || !formData.dest_group_id}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

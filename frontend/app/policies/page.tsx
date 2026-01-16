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
import { Plus, Trash2, ArrowRight, Edit, Shield, ShieldCheck, ShieldX, Users, Clock, Globe, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Slider } from "@/components/ui/slider";

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
        valid_from: "",
        valid_until: "",
        allowed_regions: "",
        min_posture_score: 0
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
            valid_from: "",
            valid_until: "",
            allowed_regions: "",
            min_posture_score: 0
        });
    };

    const handleCreate = async () => {
        if (!formData.name.trim() || !formData.source_group_id || !formData.dest_group_id) return;

        try {
            await createPolicy({
                ...formData,
                valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : undefined,
                valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : undefined,
                allowed_regions: formData.allowed_regions || undefined,
                min_posture_score: formData.min_posture_score > 0 ? formData.min_posture_score : undefined
            });
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
            await updatePolicy(selectedPolicy.id, {
                ...formData,
                valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : undefined,
                valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : undefined,
                allowed_regions: formData.allowed_regions || undefined,
                min_posture_score: formData.min_posture_score > 0 ? formData.min_posture_score : undefined
            });
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
            valid_from: policy.valid_from ? new Date(policy.valid_from).toISOString().slice(0, 16) : "",
            valid_until: policy.valid_until ? new Date(policy.valid_until).toISOString().slice(0, 16) : "",
            allowed_regions: policy.allowed_regions || "",
            min_posture_score: policy.min_posture_score || 0
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

    const columns: ColumnDef<Policy>[] = [
        {
            accessorKey: "name",
            header: "Policy",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-semibold flex items-center gap-2">
                        {row.original.enabled ? (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-muted" />
                        )}
                        {row.getValue("name")}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.original.description}</span>
                </div>
            )
        },
        {
            id: "path",
            header: "Traffic Flow",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="bg-background">{row.original.source_group?.name || "Any"}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="bg-background">{row.original.dest_group?.name || "Any"}</Badge>
                </div>
            )
        },
        {
            header: "Controls",
            id: "controls",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.valid_from && <Clock className="h-3 w-3 text-blue-500" />}
                    {row.original.allowed_regions && <Globe className="h-3 w-3 text-purple-500" />}
                    {row.original.min_posture_score && row.original.min_posture_score > 0 && (
                        <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4">
                            Score: {row.original.min_posture_score}+
                        </Badge>
                    )}
                </div>
            )
        },
        {
            accessorKey: "action",
            header: "Action",
            cell: ({ row }) => (
                <Badge variant={row.original.action === "allow" ? "default" : "destructive"}>
                    {row.original.action}
                </Badge>
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(row.original)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            )
        }
    ];

    if (loading) {
        return <div className="p-8 text-center">Loading policies...</div>;
    }

    const PolicyFormContent = () => (
        <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Policy Name</Label>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Web to DB Access" />
                </div>
                <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={formData.action} onValueChange={v => setFormData({ ...formData, action: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="allow"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-500" /> Allow</span></SelectItem>
                            <SelectItem value="deny"><span className="flex items-center gap-2"><ShieldX className="h-4 w-4 text-red-500" /> Deny</span></SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2 text-primary">
                    <Shield className="h-4 w-4" /> Traffic Rules
                </h3>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div className="space-y-2">
                        <Label>Source Group</Label>
                        <Select value={String(formData.source_group_id)} onValueChange={v => setFormData({ ...formData, source_group_id: parseInt(v) })}>
                            <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
                            <SelectContent>
                                {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                    <div className="space-y-2">
                        <Label>Destination Group</Label>
                        <Select value={String(formData.dest_group_id)} onValueChange={v => setFormData({ ...formData, dest_group_id: parseInt(v) })}>
                            <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
                            <SelectContent>
                                {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Allowed Ports (comma separated)</Label>
                    <Input value={formData.allowed_ports} onChange={e => setFormData({ ...formData, allowed_ports: e.target.value })} placeholder="80, 443, 22 or *" className="font-mono" />
                </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Lock className="h-4 w-4" /> Zero Trust Constraints
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Valid From</Label>
                        <Input type="datetime-local" value={formData.valid_from} onChange={e => setFormData({ ...formData, valid_from: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Valid Until</Label>
                        <Input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Allowed Regions (Country Codes)</Label>
                    <div className="flex gap-2">
                        <Globe className="h-8 w-8 p-2 bg-background rounded border text-muted-foreground" />
                        <Input value={formData.allowed_regions} onChange={e => setFormData({ ...formData, allowed_regions: e.target.value })} placeholder="US, UK, DE (Comma separated)" />
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex justify-between">
                        <Label className="text-xs text-muted-foreground">Minimum Device Posture Score</Label>
                        <span className="text-sm font-bold text-blue-600">{formData.min_posture_score}</span>
                    </div>
                    <Slider
                        value={[formData.min_posture_score]}
                        max={100}
                        step={5}
                        onValueChange={([val]) => setFormData({ ...formData, min_posture_score: val })}
                        className="py-2"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Devices with a score lower than {formData.min_posture_score} will be denied access even if authenticated.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                    <Label>Enable Policy</Label>
                    <p className="text-xs text-muted-foreground">Active immediately upon save</p>
                </div>
                <Switch checked={formData.enabled} onCheckedChange={checked => setFormData({ ...formData, enabled: checked })} />
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Security Policies</h1>
                    <p className="text-muted-foreground">Manage network access rules and Zero Trust constraints</p>
                </div>
                <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Policy
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <DataTable columns={columns} data={policies} filterPlaceholder="Filter policies..." filterColumn="name" />
                </CardContent>
            </Card>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Policy</DialogTitle>
                        <DialogDescription>Define access rules and security constraints.</DialogDescription>
                    </DialogHeader>
                    <PolicyFormContent />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!formData.name}>Create Rule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Policy</DialogTitle>
                    </DialogHeader>
                    <PolicyFormContent />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getGroups, createGroup, updateGroup, deleteGroup, Group } from "@/lib/api";
import { Plus, Trash2, Users, Edit, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [viewAgentsOpen, setViewAgentsOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({ name: "", description: "" });
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

    const fetchGroups = async () => {
        try {
            const data = await getGroups();
            setGroups(data);
        } catch (error) {
            console.error("Failed to fetch groups:", error);
            toast.error("Failed to fetch groups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreate = async () => {
        if (!formData.name.trim()) return;

        try {
            await createGroup(formData);
            setFormData({ name: "", description: "" });
            setCreateDialogOpen(false);
            toast.success("Group created");
            fetchGroups();
        } catch (error) {
            toast.error("Failed to create group");
        }
    };

    const handleUpdate = async () => {
        if (!selectedGroup || !formData.name.trim()) return;

        try {
            await updateGroup(selectedGroup.id, formData);
            setFormData({ name: "", description: "" });
            setSelectedGroup(null);
            setEditDialogOpen(false);
            toast.success("Group updated");
            fetchGroups();
        } catch (error) {
            toast.error("Failed to update group");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this group?")) return;

        try {
            await deleteGroup(id);
            toast.success("Group deleted");
            fetchGroups();
        } catch (error) {
            toast.error("Failed to delete group");
        }
    };

    const openEdit = (group: Group) => {
        setSelectedGroup(group);
        setFormData({ name: group.name, description: group.description });
        setEditDialogOpen(true);
    };

    const openViewAgents = (group: Group) => {
        setSelectedGroup(group);
        setViewAgentsOpen(true);
    }

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
                    <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
                    <p className="text-muted-foreground">
                        Organize agents into access control groups
                    </p>
                </div>
                <Button onClick={() => { setFormData({ name: "", description: "" }); setCreateDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Group
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Groups</CardTitle>
                    <CardDescription>
                        {groups.length} group{groups.length !== 1 ? 's' : ''} defined
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {groups.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No groups created yet. Click "New Group" to create one.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Agents</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                            {group.description || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => openViewAgents(group)}>
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <span>{group.agents?.length || 0}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(group.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEdit(group)}
                                                >
                                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(group.id)}
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Group</DialogTitle>
                        <DialogDescription>
                            Groups allow you to organize agents and create access policies.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Group Name</Label>
                            <Input
                                placeholder="e.g., Production Servers"
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
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate} disabled={!formData.name.trim()}>
                            Create Group
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Group Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleUpdate} disabled={!formData.name.trim()}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Agents Dialog */}
            <Dialog open={viewAgentsOpen} onOpenChange={setViewAgentsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Agents in {selectedGroup?.name}</DialogTitle>
                        <DialogDescription>
                            List of agents currently assigned to this group.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[300px] overflow-y-auto py-4">
                        {!selectedGroup?.agents || selectedGroup.agents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No agents in this group.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {selectedGroup.agents.map(agent => (
                                    <div key={agent.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <div>
                                                <p className="font-medium">{agent.name}</p>
                                                <p className="text-xs text-muted-foreground">{agent.ip}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/agents/${agent.id}`}>
                                                View Details
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

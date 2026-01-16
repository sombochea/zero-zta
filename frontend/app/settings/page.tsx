"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Moon, Sun, Monitor, Bell, Shield, Globe, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
    const { setTheme, theme } = useTheme();

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your preferences and system configuration
                </p>
            </div>

            <div className="grid gap-6">
                {/* Appearance */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="h-5 w-5" /> Appearance
                        </CardTitle>
                        <CardDescription>
                            Customize the look and feel of the dashboard
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <Label>Theme</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        variant={theme === "light" ? "default" : "outline"}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme("light")}
                                    >
                                        <Sun className="h-4 w-4" /> Light
                                    </Button>
                                    <Button
                                        variant={theme === "dark" ? "default" : "outline"}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme("dark")}
                                    >
                                        <Moon className="h-4 w-4" /> Dark
                                    </Button>
                                    <Button
                                        variant={theme === "system" ? "default" : "outline"}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme("system")}
                                    >
                                        <Monitor className="h-4 w-4" /> System
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" /> Notifications
                        </CardTitle>
                        <CardDescription>
                            Configure alert preferences
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Agent Offline Alerts</Label>
                                <p className="text-sm text-muted-foreground">Notify when an agent goes offline</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Security Policy Violations</Label>
                                <p className="text-sm text-muted-foreground">Notify on blocked access attempts</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>New Device Enrollment</Label>
                                <p className="text-sm text-muted-foreground">Notify when a new agent registers</p>
                            </div>
                            <Switch />
                        </div>
                    </CardContent>
                </Card>

                {/* System Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5" /> System Information
                        </CardTitle>
                        <CardDescription>
                            Version and environment details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium">Version</p>
                                <p className="text-muted-foreground">v1.2.0 (Zero Trust Edition)</p>
                            </div>
                            <div>
                                <p className="font-medium">Backend Status</p>
                                <p className="text-green-500 font-medium">Connected</p>
                            </div>
                            <div>
                                <p className="font-medium">Environment</p>
                                <p className="text-muted-foreground">Production</p>
                            </div>
                            <div>
                                <p className="font-medium">Database</p>
                                <p className="text-muted-foreground">SQLite (Embedded)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* API & Security */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" /> Security
                        </CardTitle>
                        <CardDescription>
                            API access and global security settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Minimum Global Posture Score</Label>
                            <Select defaultValue="0">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select score" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Disabled (0)</SelectItem>
                                    <SelectItem value="25">Low (25)</SelectItem>
                                    <SelectItem value="50">Medium (50)</SelectItem>
                                    <SelectItem value="75">High (75)</SelectItem>
                                    <SelectItem value="90">Strict (90)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Enforce a baseline security score for all agents.</p>
                        </div>
                        <div className="pt-4">
                            <Button variant="destructive" onClick={() => toast.error("Not implemented in demo")}>
                                Revoke All API Keys
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

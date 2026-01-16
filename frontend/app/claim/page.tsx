"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { getClaimDetails, approveClaim, ClaimDetails } from "@/lib/api";
import { ShieldCheck, Laptop, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function ClaimContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [details, setDetails] = useState<ClaimDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Initial load: Fetch claim details
    useEffect(() => {
        if (!token) {
            setError("Invalid link: Missing token");
            setLoading(false);
            return;
        }

        // Check auth (simple check)
        const userEmail = localStorage.getItem("user_email");
        if (!userEmail) {
            // Redirect to login with return URL
            const returnUrl = encodeURIComponent(`/claim?token=${token}`);
            router.push(`/login?returnUrl=${returnUrl}`);
            return;
        }

        getClaimDetails(token)
            .then(setDetails)
            .catch(() => setError("Invalid or expired claim request"))
            .finally(() => setLoading(false));
    }, [token, router]);

    const handleApprove = async () => {
        if (!token) return;
        const userEmail = localStorage.getItem("user_email");
        if (!userEmail) {
            router.push("/login");
            return;
        }

        setApproving(true);
        try {
            await approveClaim(token, userEmail);
            setSuccess(true);
            toast.success("Device approved successfully");
        } catch (err) {
            toast.error("Failed to approve device");
        } finally {
            setApproving(false);
        }
    };

    if (loading) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-4">
                    <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full max-w-md border-destructive/50">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <AlertCircle className="w-6 h-6 text-destructive" />
                    </div>
                    <CardTitle className="text-destructive">Request Failed</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                        Go to Dashboard
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (success) {
        return (
            <Card className="w-full max-w-md border-green-500/50">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-green-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <CardTitle className="text-green-600">Device Approved!</CardTitle>
                    <CardDescription>
                        <b>{details?.hostname}</b> is now connected to your network.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground">
                    You can close this window now.
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={() => router.push("/agents")}>
                        View Connected Agents
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                    <Laptop className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>New Device Request</CardTitle>
                <CardDescription>
                    A new device is requesting access to your network.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Hostname:</span>
                        <span className="font-medium font-mono">{details?.hostname}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">IP Address:</span>
                        <span className="font-medium font-mono">{details?.ip}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="capitalize">{details?.status}</span>
                    </div>
                    <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                        Request ID: {details?.token.substring(0, 8)}...
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
                <Button className="w-full" onClick={handleApprove} disabled={approving}>
                    {approving ? "Approving..." : "Approve Device"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
                    Cancel
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function ClaimPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <ClaimContent />
            </Suspense>
        </div>
    );
}

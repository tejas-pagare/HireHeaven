"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DiscoverPage() {
    const router = useRouter();

    useEffect(() => {
        router.push("/jobs");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );
}

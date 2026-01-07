import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080";
export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api/v1/")) {
        // Proxy other API requests to external service without auth
        const query = request.nextUrl.searchParams;
        const url = `${backendUrl}${pathname}?${query.toString()}`;
        const response = await fetch(url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            // @ts-ignore
            duplex: "half", // allow streaming response
        });

        const resBody = await response.text();
        const resHeaders = new Headers(response.headers);
        resHeaders.delete("content-encoding");
        resHeaders.delete("content-length");
        resHeaders.delete("transfer-encoding");

        return new NextResponse(resBody, {
            status: response.status,
            headers: resHeaders,
        });
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/v1/:path*",
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
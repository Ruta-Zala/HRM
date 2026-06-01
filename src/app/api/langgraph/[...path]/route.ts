import type { NextRequest } from "next/server";

import { getLangGraphInternalApiUrl } from "@/lib/langgraph/config";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyToLangGraph(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = new URL(path.join("/"), `${getLangGraphInternalApiUrl()}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyToLangGraph(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyToLangGraph(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyToLangGraph(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToLangGraph(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToLangGraph(request, context);
}

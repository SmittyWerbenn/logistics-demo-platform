import type { Ctx } from "./types";

type Handler = (ctx: Ctx, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler) {
    this.routes.push({ method, segments: path.split("/").filter(Boolean), handler });
  }

  get(path: string, handler: Handler) {
    this.add("GET", path, handler);
  }
  post(path: string, handler: Handler) {
    this.add("POST", path, handler);
  }
  patch(path: string, handler: Handler) {
    this.add("PATCH", path, handler);
  }
  delete(path: string, handler: Handler) {
    this.add("DELETE", path, handler);
  }

  async handle(ctx: Ctx, pathname: string): Promise<Response | null> {
    const requestSegments = pathname.split("/").filter(Boolean);
    const method = ctx.request.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== requestSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const routeSeg = route.segments[i];
        const reqSeg = requestSegments[i];
        if (routeSeg.startsWith(":")) {
          params[routeSeg.slice(1)] = decodeURIComponent(reqSeg);
        } else if (routeSeg !== reqSeg) {
          matched = false;
          break;
        }
      }
      if (matched) return route.handler(ctx, params);
    }
    return null;
  }
}

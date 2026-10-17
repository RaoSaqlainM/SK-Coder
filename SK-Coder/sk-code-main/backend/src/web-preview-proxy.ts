import net from "node:net";
import { request as httpRequest, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { getWebPreviewTarget } from "./lib/webPreviewSessionManager.js";
import { isAllowedOrigin } from "./lib/originPolicy.js";

function parsePreviewPath(url: string) {
    const parsed = new URL(url, "http://localhost");
    const match = parsed.pathname.match(/^\/api\/previews\/sessions\/([^/]+)\/view\/([^/]+)(\/.*)?$/);
    if (!match)
        return null;
    return { id: decodeURIComponent(match[1]), token: decodeURIComponent(match[2]), targetPath: `${match[3] || "/"}${parsed.search}` };
}

export function proxyWebPreviewHttpRequest(req: IncomingMessage, res: any, id: string, token: string) {
    void getWebPreviewTarget(id, token).then(({ host, port }) => {
        const parsed = parsePreviewPath(req.url || "/");
        const upstream = httpRequest({ hostname: host, port, method: req.method, path: parsed?.targetPath || "/", headers: { ...req.headers, host: `${host}:${port}` } }, (upstreamResponse) => {
            res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
            upstreamResponse.pipe(res);
        });
        upstream.once("error", () => res.headersSent ? res.destroy() : res.status(502).send("Project preview is unavailable."));
        req.pipe(upstream);
    }).catch(() => res.status(404).send("Project preview session not found or expired."));
}

export function setupWebPreviewProxy(server: any) {
    server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
        const parsed = parsePreviewPath(request.url || "");
        if (!parsed)
            return;
        if (!isAllowedOrigin(request.headers.origin)) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            return socket.destroy();
        }
        void getWebPreviewTarget(parsed.id, parsed.token).then(({ host, port }) => {
            const upstream = net.connect(port, host, () => {
                const lines: string[] = [`GET ${parsed.targetPath} HTTP/${request.httpVersion}`, `Host: ${host}:${port}`];
                for (let index = 0; index < request.rawHeaders.length; index += 2) {
                    const name = request.rawHeaders[index];
                    const value = request.rawHeaders[index + 1];
                    if (name.toLowerCase() !== "host")
                        lines.push(`${name}: ${value}`);
                }
                upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
                if (head.length)
                    upstream.write(head);
                socket.pipe(upstream).pipe(socket);
            });
            upstream.once("error", () => socket.destroy());
        }).catch(() => {
            socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
            socket.destroy();
        });
    });
}

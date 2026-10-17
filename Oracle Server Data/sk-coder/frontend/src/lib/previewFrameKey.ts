import type { PreviewViewport } from "@/types/ide";

export function previewFrameKey(viewport: PreviewViewport, revision: number, activePath: string | undefined, isExternal: boolean, externalUrl: string): string {
    return `${viewport}:${revision}:${activePath || "workspace"}:${isExternal ? externalUrl : "local"}`;
}

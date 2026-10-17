import type { FileNode } from "@/types/ide";

export function isBrowserAssetOnly(node: Pick<FileNode, "assetBlobId" | "content"> | undefined): boolean {
    return Boolean(node?.assetBlobId && node.content === undefined);
}

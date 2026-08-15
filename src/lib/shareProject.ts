import JSZip from "jszip"
import { fileDataUrl, type FileNode } from "@/types/ide"

function decodeBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function append(zip: JSZip, node: FileNode, prefix = "") {
  const path = `${prefix}${node.name}`
  if (node.type === "file") {
    zip.file(path, node.encoding === "base64" ? decodeBase64(node.content ?? "") : node.content ?? "")
    return
  }
  node.children?.forEach((child) => append(zip, child, `${path}/`))
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function previewAssetUrl(node: FileNode) {
  return node.encoding === "base64" ? fileDataUrl(node) : ""
}

export async function nodeToZipBlob(node: FileNode) {
  const zip = new JSZip()
  append(zip, node)
  return zip.generateAsync({ type: "blob" })
}

export async function shareBlobOrDownload(name: string, blob: Blob) {
  if (navigator.share && navigator.canShare?.({ files: [new File([blob], name)] })) await navigator.share({ files: [new File([blob], name)], title: name })
  else download(name, blob)
}

export async function shareTextOrDownload(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  await shareBlobOrDownload(name, blob)
}

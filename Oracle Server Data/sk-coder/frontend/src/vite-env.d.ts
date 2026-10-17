import "vite/client"
interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_WS_URL?: string;
    readonly VITE_PISTON_URL?: string;
    readonly VITE_WANDBOX_URL?: string;
    readonly VITE_ENABLE_WANDBOX?: string;
    readonly VITE_ENABLE_PISTON?: string;
    readonly VITE_STORAGE_QUOTA_BYTES?: string;
    readonly VITE_STORAGE_WARN_PERCENT?: string;
    readonly VITE_STORAGE_CRITICAL_PERCENT?: string;
    readonly VITE_TEMP_FILE_TTL_HOURS?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
declare module "*.png" {
    const value: string;
    export default value;
}
declare module "*.jpg" {
    const value: string;
    export default value;
}
declare module "*.jpeg" {
    const value: string;
    export default value;
}
declare module "*.gif" {
    const value: string;
    export default value;
}
declare module "*.svg" {
    const value: string;
    export default value;
}

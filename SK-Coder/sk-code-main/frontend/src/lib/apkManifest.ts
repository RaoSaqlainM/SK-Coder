export type ApkManifestMetadataField = "packageName" | "appLabel" | "appIcon" | "installLocation" | "versionCode" | "versionName" | "minSdkVersion" | "targetSdkVersion";

export type ApkManifestMetadata = Record<ApkManifestMetadataField, string> & {
    permissions: string[];
    activities: string[];
    services: string[];
    fileSize?: number;
    sha256Signature?: string;
};

function readAttribute(tag: string, name: string) {
    return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function escapeAttribute(value: string) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function replaceAttribute(tag: string, name: string, value: string) {
    const expression = new RegExp(`\\s${name}=["'][^"']*["']`, "i");
    const next = `${name}="${escapeAttribute(value)}"`;
    return expression.test(tag) ? tag.replace(expression, ` ${next}`) : tag.replace(/>$/, ` ${next}>`);
}

function updateTag(xml: string, expression: RegExp, name: string, value: string) {
    return xml.replace(expression, (tag) => replaceAttribute(tag, name, value));
}

function extractPermissions(xml: string): string[] {
    const permissions: string[] = [];
    const permissionRegex = /<uses-permission[^>]+android:name="([^"]+)"/gi;
    let match;
    while ((match = permissionRegex.exec(xml)) !== null) {
        permissions.push(match[1]);
    }
    return permissions;
}

function extractActivities(xml: string): string[] {
    const activities: string[] = [];
    const activityRegex = /<activity[^>]+android:name="([^"]+)"/gi;
    let match;
    while ((match = activityRegex.exec(xml)) !== null) {
        activities.push(match[1]);
    }
    return activities;
}

function extractServices(xml: string): string[] {
    const services: string[] = [];
    const serviceRegex = /<service[^>]+android:name="([^"]+)"/gi;
    let match;
    while ((match = serviceRegex.exec(xml)) !== null) {
        services.push(match[1]);
    }
    return services;
}

export function readApkManifestMetadata(xml: string): ApkManifestMetadata {
    const manifest = xml.match(/<manifest\b[^>]*>/i)?.[0] || "";
    const application = xml.match(/<application\b[^>]*>/i)?.[0] || "";
    const usesSdk = xml.match(/<uses-sdk\b[^>]*>/i)?.[0] || "";
    const installLocation = readAttribute(manifest, "android:installLocation");
    
    return {
        packageName: readAttribute(manifest, "package"),
        appLabel: readAttribute(application, "android:label"),
        appIcon: readAttribute(application, "android:icon"),
        installLocation: ["auto", "internalOnly", "preferExternal"].includes(installLocation) ? installLocation : "auto",
        versionCode: readAttribute(manifest, "android:versionCode"),
        versionName: readAttribute(manifest, "android:versionName"),
        minSdkVersion: readAttribute(usesSdk, "android:minSdkVersion"),
        targetSdkVersion: readAttribute(usesSdk, "android:targetSdkVersion"),
        permissions: extractPermissions(xml),
        activities: extractActivities(xml),
        services: extractServices(xml),
    };
}

export function updateApkManifestMetadata(xml: string, field: ApkManifestMetadataField, value: string) {
    if (["packageName", "versionCode", "versionName", "installLocation"].includes(field)) {
        const attribute = field === "packageName" ? "package" : field === "versionCode" ? "android:versionCode" : field === "versionName" ? "android:versionName" : "android:installLocation";
        return updateTag(xml, /<manifest\b[^>]*>/i, attribute, value);
    }
    if (field === "appLabel" || field === "appIcon") {
        return updateTag(xml, /<application\b[^>]*>/i, field === "appLabel" ? "android:label" : "android:icon", value);
    }
    const attribute = field === "minSdkVersion" ? "android:minSdkVersion" : "android:targetSdkVersion";
    if (/<uses-sdk\b[^>]*>/i.test(xml)) {
        return updateTag(xml, /<uses-sdk\b[^>]*>/i, attribute, value);
    }
    return xml.replace(/<manifest\b[^>]*>/i, (tag) => `${tag}\n    <uses-sdk ${attribute}="${escapeAttribute(value)}"/>`);
}

export function sdkToAndroidVersion(sdkLevel: string): string {
    const sdk = parseInt(sdkLevel);
    if (isNaN(sdk)) return "Unknown";
    
    const versions: Record<number, string> = {
        1: "Android 1.0",
        2: "Android 1.1",
        3: "Android 1.5 (Cupcake)",
        4: "Android 1.6 (Donut)",
        5: "Android 2.0 (Eclair)",
        6: "Android 2.0.1 (Eclair)",
        7: "Android 2.1 (Eclair)",
        8: "Android 2.2 (Froyo)",
        9: "Android 2.3 (Gingerbread)",
        10: "Android 2.3.3 (Gingerbread)",
        11: "Android 3.0 (Honeycomb)",
        12: "Android 3.1 (Honeycomb)",
        13: "Android 3.2 (Honeycomb)",
        14: "Android 4.0 (Ice Cream Sandwich)",
        15: "Android 4.0.3 (Ice Cream Sandwich)",
        16: "Android 4.1 (Jelly Bean)",
        17: "Android 4.2 (Jelly Bean)",
        18: "Android 4.3 (Jelly Bean)",
        19: "Android 4.4 (KitKat)",
        20: "Android 4.4W (KitKat Wear)",
        21: "Android 5.0 (Lollipop)",
        22: "Android 5.1 (Lollipop)",
        23: "Android 6.0 (Marshmallow)",
        24: "Android 7.0 (Nougat)",
        25: "Android 7.1 (Nougat)",
        26: "Android 8.0 (Oreo)",
        27: "Android 8.1 (Oreo)",
        28: "Android 9 (Pie)",
        29: "Android 10",
        30: "Android 11",
        31: "Android 12",
        32: "Android 12L",
        33: "Android 13",
        34: "Android 14",
    };
    
    return versions[sdk] || `Android API ${sdk}`;
}

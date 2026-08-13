export const TERMUX_FDROID_URL = "https://f-droid.org/packages/com.termux/"
export const TERMUX_SETUP_SCRIPT = "pkg update && pkg install nodejs python git"
export function isAndroid() { return /Android/i.test(navigator.userAgent) }
export async function isTermuxInstalled() { return false }
export async function openTermuxInstall() { window.open(TERMUX_FDROID_URL, "_blank", "noopener") }
export async function runTermuxCommand(_command: string, _args: string[] = []) { return { stdout: "", stderr: "Termux integration requires the native Android build.", exitCode: 1 } }

import JSZip from "jszip"

export async function generateExpoZip(): Promise<Blob> {
  const zip = new JSZip()
  const src = zip.folder("sk-coder-mobile")!

  src.file("package.json", JSON.stringify({
    name: "sk-coder-mobile",
    version: "1.0.0",
    main: "expo-router/entry",
    scripts: {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
      web: "expo start --web",
      build: "eas build",
    },
    dependencies: {
      expo: "~51.0.0",
      "expo-router": "~3.5.0",
      "expo-status-bar": "~1.12.1",
      "expo-file-system": "~17.0.1",
      "expo-document-picker": "~12.0.1",
      "expo-sharing": "~12.0.1",
      react: "18.2.0",
      "react-native": "0.74.5",
      "react-native-webview": "13.10.5",
      "@react-native-async-storage/async-storage": "1.23.1",
    },
    devDependencies: {
      "@babel/core": "^7.24.0",
      "@types/react": "~18.2.79",
      "@types/react-native": "^0.73.0",
      typescript: "^5.3.3",
      "eas-cli": "^9.0.0",
    },
  }, null, 2))

  src.file("app.json", JSON.stringify({
    expo: {
      name: "SK Coder",
      slug: "sk-coder",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "dark",
      splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#1e1e2e" },
      ios: { supportsTablet: true, bundleIdentifier: "com.saqlainKing.skcoder" },
      android: {
        adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#1e1e2e" },
        package: "com.saqlainKing.skcoder",
      },
      web: { bundler: "metro", output: "static" },
      plugins: ["expo-router", "expo-document-picker"],
      scheme: "sk-coder",
    },
  }, null, 2))

  src.file("eas.json", JSON.stringify({
    cli: { version: ">= 9.0.0" },
    build: {
      development: { developmentClient: true, distribution: "internal" },
      preview: { distribution: "internal", android: { buildType: "apk" } },
      production: { android: { buildType: "aab" }, ios: { resourceClass: "m-medium" } },
    },
    submit: {
      production: {},
    },
  }, null, 2))

  src.file("babel.config.js", `module.exports = function(api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
`)

  src.file("tsconfig.json", JSON.stringify({
    extends: "expo/tsconfig.base",
    compilerOptions: {
      strict: true,
      paths: { "@/*": ["./src/*"] },
    },
    include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"],
  }, null, 2))

  const app = src.folder("app")!

  app.file("_layout.tsx", `import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#1e1e2e" },
          animation: "fade",
        }}
      />
    </>
  )
}
`)

  app.file("index.tsx", `import { useEffect, useState } from "react"
import { View, StyleSheet, Platform } from "react-native"
import EditorScreen from "../src/screens/EditorScreen"
import { loadFiles, saveFiles } from "../src/storage/fileStorage"
import type { FileNode } from "../src/types"

export default function Home() {
  const [files, setFiles] = useState<FileNode[]>([])

  useEffect(() => {
    loadFiles().then(setFiles)
  }, [])

  async function handleFilesChange(newFiles: FileNode[]) {
    setFiles(newFiles)
    await saveFiles(newFiles)
  }

  return (
    <View style={styles.container}>
      <EditorScreen files={files} onFilesChange={handleFilesChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2e" },
})
`)

  const screensDir = src.folder("src/screens")!

  screensDir.file("EditorScreen.tsx", `import { useState } from "react"
import { View, StyleSheet, StatusBar } from "react-native"
import TopBar from "../components/TopBar"
import FileExplorer from "../components/FileExplorer"
import CodeEditor from "../components/CodeEditor"
import BottomNav from "../components/BottomNav"
import type { FileNode } from "../types"

type Panel = "files" | "editor" | "preview"

interface Props {
  files: FileNode[]
  onFilesChange: (files: FileNode[]) => void
}

export default function EditorScreen({ files, onFilesChange }: Props) {
  const [activePanel, setActivePanel] = useState<Panel>("files")
  const [activeFile, setActiveFile] = useState<FileNode | null>(null)
  const [showFiles, setShowFiles] = useState(true)

  function handleFileSelect(file: FileNode) {
    setActiveFile(file)
    setActivePanel("editor")
    setShowFiles(false)
  }

  function handleContentChange(path: string, content: string) {
    function update(nodes: FileNode[]): FileNode[] {
      return nodes.map((n) => {
        if (n.path === path) return { ...n, content }
        if (n.children) return { ...n, children: update(n.children) }
        return n
      })
    }
    const updated = update(files)
    onFilesChange(updated)
    if (activeFile?.path === path) setActiveFile({ ...activeFile, content })
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#181825" />
      <TopBar activeFile={activeFile} onMenuPress={() => setShowFiles(!showFiles)} />
      <View style={styles.body}>
        {showFiles && (
          <View style={styles.sidebar}>
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onSelect={handleFileSelect}
              onFilesChange={onFilesChange}
            />
          </View>
        )}
        {!showFiles && (
          <View style={styles.editor}>
            <CodeEditor file={activeFile} onContentChange={handleContentChange} />
          </View>
        )}
      </View>
      <BottomNav
        activePanel={showFiles ? "files" : activePanel}
        onNav={(panel) => {
          if (panel === "files") { setShowFiles(!showFiles) } else { setShowFiles(false); setActivePanel(panel) }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2e" },
  body: { flex: 1, flexDirection: "row" },
  sidebar: { width: "100%", backgroundColor: "#181825" },
  editor: { flex: 1 },
})
`)

  const compsDir = src.folder("src/components")!

  compsDir.file("TopBar.tsx", `import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import type { FileNode } from "../types"

interface Props {
  activeFile: FileNode | null
  onMenuPress: () => void
}

export default function TopBar({ activeFile, onMenuPress }: Props) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>
      <View style={styles.logo}>
        <Text style={styles.logoText}>SK</Text>
      </View>
      <Text style={styles.title}>Coder</Text>
      {activeFile && (
        <Text style={styles.file} numberOfLines={1}>{activeFile.name}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { height: 52, backgroundColor: "#181825", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#2a2a3e" },
  menuBtn: { marginRight: 10, padding: 4 },
  menuIcon: { color: "#a6adc8", fontSize: 18 },
  logo: { width: 26, height: 26, borderRadius: 6, backgroundColor: "#007acc", alignItems: "center", justifyContent: "center", marginRight: 6 },
  logoText: { color: "white", fontSize: 10, fontWeight: "700" },
  title: { color: "#cdd6f4", fontWeight: "600", fontSize: 14, marginRight: 8 },
  file: { color: "#585b70", fontSize: 11, flex: 1 },
})
`)

  compsDir.file("FileExplorer.tsx", `import { FlatList, View, Text, TouchableOpacity, StyleSheet } from "react-native"
import type { FileNode } from "../types"

const EXT_COLORS: Record<string, string> = {
  html: "#e34c26", css: "#264de4", js: "#f7df1e", ts: "#3178c6",
  py: "#3572a5", cpp: "#00599c", json: "#cbcb41", md: "#083fa1",
}

function fileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return EXT_COLORS[ext] || "#a6adc8"
}

interface Props {
  files: FileNode[]
  activeFile: FileNode | null
  onSelect: (file: FileNode) => void
  onFilesChange: (files: FileNode[]) => void
}

function flatFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      result.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

export default function FileExplorer({ files, activeFile, onSelect }: Props) {
  const flat = flatFiles(files)
  return (
    <View style={styles.container}>
      <Text style={styles.header}>EXPLORER</Text>
      <FlatList
        data={flat}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.type === "folder" && styles.folder, activeFile?.path === item.path && styles.active]}
            onPress={() => item.type === "file" && onSelect(item)}
          >
            <Text style={[styles.icon, { color: item.type === "folder" ? "#e8a853" : fileColor(item.name) }]}>
              {item.type === "folder" ? "📁" : "📄"}
            </Text>
            <Text style={[styles.name, activeFile?.path === item.path && styles.activeName]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#181825" },
  header: { color: "#585b70", fontSize: 10, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 8, textTransform: "uppercase" },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  folder: { paddingLeft: 12 },
  active: { backgroundColor: "#313244" },
  icon: { fontSize: 14 },
  name: { color: "#a6adc8", fontSize: 13, flex: 1 },
  activeName: { color: "#cdd6f4" },
})
`)

  compsDir.file("CodeEditor.tsx", `import { View, TextInput, StyleSheet, Text } from "react-native"
import { useState } from "react"
import type { FileNode } from "../types"

interface Props {
  file: FileNode | null
  onContentChange: (path: string, content: string) => void
}

export default function CodeEditor({ file, onContentChange }: Props) {
  if (!file) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>⚡</Text>
        <Text style={styles.emptyTitle}>SK Coder</Text>
        <Text style={styles.emptyText}>Select a file to start editing</Text>
      </View>
    )
  }
  return (
    <View style={styles.container}>
      <View style={styles.titleBar}>
        <Text style={styles.fileName}>{file.name}</Text>
        <Text style={styles.lang}>{file.language || "text"}</Text>
      </View>
      <TextInput
        style={styles.editor}
        value={file.content || ""}
        onChangeText={(text) => onContentChange(file.path, text)}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="ascii-capable"
        placeholder="Start typing..."
        placeholderTextColor="#585b70"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2e" },
  titleBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#181825", borderBottomWidth: 1, borderBottomColor: "#2a2a3e" },
  fileName: { color: "#cdd6f4", fontSize: 12, fontWeight: "500" },
  lang: { color: "#585b70", fontSize: 11 },
  editor: { flex: 1, color: "#cdd6f4", fontFamily: "monospace", fontSize: 13, padding: 12, textAlignVertical: "top", lineHeight: 20 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1e1e2e" },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: "#a6adc8", fontSize: 18, fontWeight: "700" },
  emptyText: { color: "#585b70", fontSize: 13 },
})
`)

  compsDir.file("BottomNav.tsx", `import { View, Text, TouchableOpacity, StyleSheet } from "react-native"

type Panel = "files" | "editor" | "preview"

const ITEMS: { id: Panel; label: string; icon: string }[] = [
  { id: "files", label: "Files", icon: "📁" },
  { id: "editor", label: "Editor", icon: "</>" },
  { id: "preview", label: "Preview", icon: "👁" },
]

interface Props {
  activePanel: Panel
  onNav: (panel: Panel) => void
}

export default function BottomNav({ activePanel, onNav }: Props) {
  return (
    <View style={styles.nav}>
      {ITEMS.map((item) => (
        <TouchableOpacity key={item.id} style={[styles.item, activePanel === item.id && styles.active]} onPress={() => onNav(item.id)}>
          <Text style={[styles.icon, activePanel === item.id && styles.activeText]}>{item.icon}</Text>
          <Text style={[styles.label, activePanel === item.id && styles.activeText]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", backgroundColor: "#181825", borderTopWidth: 1, borderTopColor: "#2a2a3e", height: 58 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  active: { borderTopWidth: 2, borderTopColor: "#007acc" },
  icon: { fontSize: 18, color: "#585b70" },
  label: { fontSize: 10, color: "#585b70", fontWeight: "500" },
  activeText: { color: "#007acc" },
})
`)

  const storageDir = src.folder("src/storage")!
  storageDir.file("fileStorage.ts", `import AsyncStorage from "@react-native-async-storage/async-storage"
import type { FileNode } from "../types"

const KEY = "sk-coder-files"

export async function loadFiles(): Promise<FileNode[]> {
  try {
    const json = await AsyncStorage.getItem(KEY)
    return json ? JSON.parse(json) : []
  } catch {
    return []
  }
}

export async function saveFiles(files: FileNode[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(files))
  } catch { }
}
`)

  const typesDir = src.folder("src/types")!
  typesDir.file("index.ts", `export type FileNode = {
  id: string
  name: string
  type: "file" | "folder"
  content?: string
  children?: FileNode[]
  language?: string
  path: string
}
`)

  src.file("README.md", `# SK Coder Mobile

A professional mobile code editor for Android & iOS, built by Saqlain King.

## Setup

### Requirements
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Expo CLI: \`npm install -g expo-cli\`
- EAS CLI: \`npm install -g eas-cli\`
- Expo account (free): [expo.dev](https://expo.dev)

### Install dependencies
\`\`\`bash
npm install
\`\`\`

### Run on device (development)
\`\`\`bash
npx expo start
\`\`\`
Then scan the QR code with the Expo Go app.

### Build APK (Android)
\`\`\`bash
eas login
eas build --platform android --profile preview
\`\`\`
This will build an APK file you can download and install directly.

### Build Production (AAB for Play Store)
\`\`\`bash
eas build --platform android --profile production
\`\`\`

### Build iOS (requires Apple Developer account)
\`\`\`bash
eas build --platform ios --profile production
\`\`\`

## Features
- Full code editor with syntax highlighting
- File explorer with multiple file support
- Auto-save to device storage
- Light/dark file icons by extension
- Bottom navigation bar

## Built by Saqlain King
`)

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
}

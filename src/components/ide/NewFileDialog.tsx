import { useState } from "react";
import { useIDEStore } from "@/store/ideStore";
import { X, Search, FolderPlus, FilePlus } from "lucide-react";
import { FILE_CATEGORIES, generateId, getLanguageFromExtension } from "@/types/ide";

interface Props {
  open: boolean;
  onClose: () => void;
  parentPath: string;
}

export default function NewFileDialog({ open, onClose, parentPath }: Props) {
  const [mode, setMode] = useState<"category" | "custom">("category");
  const [customName, setCustomName] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { addFileNode, openFile } = useIDEStore();

  if (!open) return null;

  const handleCreateFromTemplate = (name: string, ext: string, template: string) => {
    const fileName = ext ? `untitled${ext}` : name;
    const path = parentPath ? `${parentPath}/${fileName}` : fileName;
    const node = {
      id: generateId(),
      name: fileName,
      type: "file" as const,
      path,
      content: template,
      language: getLanguageFromExtension(fileName),
    };
    addFileNode(parentPath, node);
    openFile(node);
    resetAndClose();
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    const path = parentPath ? `${parentPath}/${customName}` : customName;
    const node = {
      id: generateId(),
      name: customName,
      type: "file" as const,
      path,
      content: "",
      language: getLanguageFromExtension(customName),
    };
    addFileNode(parentPath, node);
    openFile(node);
    resetAndClose();
  };

  const handleCreateFolder = () => {
    if (!customName.trim()) return;
    const path = parentPath ? `${parentPath}/${customName}` : customName;
    addFileNode(parentPath, {
      id: generateId(),
      name: customName,
      type: "folder",
      path,
      children: [],
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setCustomName("");
    setSearch("");
    setActiveCategory(null);
    setMode("category");
    onClose();
  };

  const allTemplates = Object.entries(FILE_CATEGORIES).flatMap(([cat, items]) =>
    items.map((item) => ({ ...item, category: cat }))
  );

  const filtered = search
    ? allTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.ext.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase())
      )
    : allTemplates;

  const categories = Object.keys(FILE_CATEGORIES);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={resetAndClose}>
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            {parentPath ? `New in ${parentPath}` : "New File / Folder"}
          </h3>
          <button onClick={resetAndClose} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-3 pt-3">
          {(["category", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {m === "category" ? "Templates" : "Custom"}
            </button>
          ))}
        </div>

        {mode === "category" ? (
          <>
            <div className="px-3 pt-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-secondary text-sm text-foreground pl-8 pr-3 py-2 rounded-md outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>
            {!search && (
              <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors ${
                    !activeCategory ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors ${
                      activeCategory === cat ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
              {search ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {filtered.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => handleCreateFromTemplate(t.name, t.ext, t.template)}
                      className="text-left p-2.5 rounded-md text-xs bg-secondary/40 hover:bg-secondary border border-transparent hover:border-border transition-all"
                    >
                      <span className="text-foreground font-medium">{t.name}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">{t.ext}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-2 text-center text-xs text-muted-foreground py-4">No matching templates</p>
                  )}
                </div>
              ) : (
                Object.entries(FILE_CATEGORIES)
                  .filter(([cat]) => !activeCategory || cat === activeCategory)
                  .map(([category, items]) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{category}</h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {items.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => handleCreateFromTemplate(item.name, item.ext, item.template)}
                            className="text-left p-2.5 rounded-md text-xs bg-secondary/40 hover:bg-secondary border border-transparent hover:border-border transition-all"
                          >
                            <span className="text-foreground font-medium block">{item.name}</span>
                            <span className="text-muted-foreground text-[10px]">{item.ext || "(no ext)"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </>
        ) : (
          <div className="p-3 flex flex-col gap-3">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter filename (e.g. main.py) or folder name"
              className="w-full bg-secondary text-sm text-foreground px-3 py-2.5 rounded-md outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCustom();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCustom}
                disabled={!customName.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
              >
                <FilePlus className="w-3.5 h-3.5" />
                Create File
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!customName.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground text-xs py-2.5 rounded-md hover:bg-secondary/80 disabled:opacity-40 transition-colors font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Create Folder
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Tip: Add any extension like .py, .rs, .custom — all formats supported
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

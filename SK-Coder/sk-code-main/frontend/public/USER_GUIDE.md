# SK Coder — User Guide

**Welcome to SK Coder** — Your cloud-based IDE for coding anywhere, on any device.

---

## Quick Start (2 Minutes)

### 1. Open SK Coder
Visit: **https://skcoder.app**

### 2. Create Your First File
1. Click **"+ New File"** in the left sidebar
2. Choose a language template (Python, JavaScript, HTML, etc.)
3. Give it a name: `hello.py`
4. Click **Create**

### 3. Write Some Code
```python
def greet(name):
    return f"Hello, {name}!"

result = greet("World")
print(result)
```

### 4. Run It
1. Click the **"Run"** button (top-right)
2. Select **"Python"** from the dropdown
3. See your output in the **Preview** pane

**Done!** That's SK Coder in action.

---

## Features Explained

### The Left Sidebar (File Explorer)

**What it does:**
- Shows all your files and folders
- Click files to open them in the editor
- Drag and drop to organize files
- Right-click for context menu

**Right-Click Options:**
- **Run** — Execute the file (terminal)
- **Preview** — View HTML files in a browser-like window
- **Download** — Save to your computer
- **Delete** — Remove the file (confirm required)
- **Rename** — Edit the filename
- **New File** — Create a new file in this folder
- **New Folder** — Create a new folder

**File Templates:**
When creating a new file, choose from:
- **Python** — `hello.py`
- **JavaScript** — `script.js`
- **HTML** — `index.html`
- **CSS** — `style.css`
- **React** — `component.jsx`
- **More...** — 15+ languages supported

### The Code Editor (Center)

**Features:**
- **Syntax Highlighting** — Colors for different code elements
- **Auto-Completion** — Press Ctrl+Space to get suggestions
- **Multi-Tab Editing** — Click the `+` tab to open multiple files
- **Line Numbers** — Click a line number to select it
- **Minimap** — Right side shows a preview of your entire file (optional in settings)
- **Find & Replace** — Press Ctrl+H to find and replace text
- **Format Code** — Press Ctrl+Shift+F to auto-format (Python, JavaScript, etc.)

**Keyboard Shortcuts:**
| Action | Shortcut |
|--------|----------|
| Save | Ctrl+S (auto-saved every 10 seconds) |
| Find | Ctrl+F |
| Replace | Ctrl+H |
| Format | Ctrl+Shift+F |
| Comment | Ctrl+/ |
| Duplicate Line | Ctrl+D |
| Delete Line | Ctrl+Shift+K |
| Move Line Up | Alt+↑ |
| Move Line Down | Alt+↓ |

### The Preview Pane (Right)

**What it shows:**
- **Terminal Output** — Results of running Python, JavaScript, Bash commands
- **HTML Preview** — Rendered HTML files (click "Preview" button)
- **Device Frames** — See how your website looks on mobile/tablet/desktop
- **Error Messages** — If your code fails, errors appear here with suggestions

**Device Preview:**
Click the device buttons to see your HTML on:
- **📱 iPhone 12** — Mobile view (375px wide)
- **📱 iPad** — Tablet view (768px wide)
- **🖥️ Desktop** — Full desktop (1200px wide)

### The Terminal (Bottom)

**4 Terminal Types:**

**1. Shell Terminal** (`bash`, `sh` commands)
```bash
$ ls                    # List files
$ cd folder_name        # Enter a folder
$ mkdir my_folder       # Create a folder
$ cat file.txt          # View file contents
$ echo "Hello"          # Print text
$ run script.py         # Run a Python file
$ run app.js            # Run a JavaScript file
$ help                  # Show all commands
```

**2. Python Terminal**
```python
>>> print("Hello, Python!")
>>> x = 10
>>> y = 20
>>> print(x + y)
>>> import math
>>> math.sqrt(16)
```
Upload `.py` files and run them directly.

**3. Node.js Terminal**
```javascript
> console.log("Hello, Node.js!")
> const x = 10;
> console.log(x * 2);
> require('path')
> // Full Node.js API available
```
Upload `.js` files and run them instantly.

**4. AI Assistant Terminal**
Ask SK Coder AI questions:
- "How do I read a file in Python?"
- "Fix this error: [paste error message]"
- "Generate a function that [description]"
- "Explain this code: [paste code]"

**Terminal History:**
- Press **↑** (up arrow) to see previous commands
- Press **↓** (down arrow) to move forward in history
- Press **Tab** to auto-complete filenames

### Settings Panel

Click **⚙️ Settings** (top-right) to customize:

**Editor Settings:**
- Font size (8-32px)
- Tab size (2 or 4 spaces)
- Theme (dark/light)
- Word wrap on/off
- Line numbers on/off
- Minimap on/off

**AI Settings:**
- Add your own **OpenAI API key** (free trial available)
- Or use free **Puter.js** AI (optional)
- Auto-context (AI remembers your file when helping)

**GitHub Settings:**
- Sign in with GitHub
- Authorize SK Coder to access your repos
- Commit and push code directly from SK Coder

**Preview Settings:**
- Default device type
- Auto-refresh on run
- Server port for preview

**Storage Settings:**
- View workspace size
- Clear cache
- Export all files as ZIP
- Delete workspace

---

## How to Use Each Language

### Python 3

**Create a file:** `hello.py`

```python
name = input("What's your name? ")
print(f"Hello, {name}!")
```

**Run it:**
1. Click file → Click **Run** button
2. Or in terminal: `run hello.py`
3. See output in preview pane

**What works:**
- All standard library (math, datetime, json, etc.)
- Import external packages (requests, numpy coming soon)
- File I/O (reading/writing files in your workspace)
- Full Python 3.11 syntax

**Limits:**
- Execution timeout: 30 seconds
- Memory limit: 256MB
- No system shell commands (use terminal for that)

### JavaScript / Node.js

**Create a file:** `script.js`

```javascript
const fs = require('fs');
const path = require('path');

console.log("Current directory:", path.join("/"));
console.log("Hello from Node.js!");
```

**Run it:**
1. Click file → Click **Run**
2. Or in terminal: `run script.js`

**What works:**
- Full Node.js 20 API
- ES6+ syntax (async/await, arrow functions, etc.)
- CommonJS and import/export
- npm modules (limited list pre-installed)

**Limits:**
- No `child_process` (can't spawn subprocesses)
- No direct file system write to server
- 30-second timeout

### HTML / CSS / JavaScript

**Create a file:** `index.html`

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
    <style>
        body { font-family: Arial; text-align: center; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Welcome to SK Coder!</h1>
    <button onclick="handleClick()">Click Me</button>
    <p id="output"></p>

    <script>
        function handleClick() {
            document.getElementById("output").innerText = "You clicked the button!";
        }
    </script>
</body>
</html>
```

**Preview it:**
1. Right-click the file → Select **Preview**
2. See it rendered in the preview pane
3. Click device buttons to see on mobile/tablet
4. Interact with buttons, forms, etc.

### Bash / Shell

**In the Shell terminal:**
```bash
$ echo "Hello from Bash"
$ ls -la
$ mkdir projects
$ cd projects
$ echo "test" > file.txt
$ cat file.txt
```

**What works:**
- Most Unix commands (ls, cd, mkdir, rm, cat, grep, etc.)
- File operations
- Text processing

**Limits:**
- No root/sudo access
- No installation of new programs
- Limited to your workspace

---

## Uploading and Organizing Projects

### Upload ZIP Files

1. **Create a ZIP** on your computer
   - Put all your project files inside
   - Click **Upload ZIP** button (top sidebar)

2. **SK Coder auto-extracts** everything
   - Preserves folder structure perfectly
   - Your files appear in left sidebar
   - Ready to edit immediately

**Example:**
```
my-project.zip
├── index.html
├── style.css
├── script.js
└── images/
    └── logo.png
```

↓ Uploads as:

```
my-project/
├── index.html
├── style.css
├── script.js
└── images/
    └── logo.png
```

### Organize Your Files

**Best Practices:**
```
workspace/
├── projects/
│   ├── portfolio/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── calculator/
│   │   ├── app.py
│   │   └── requirements.txt
│   └── chatbot/
│       ├── main.js
│       └── config.json
├── notes/
├── temp/
└── learning/
```

---

## GitHub Integration

### Sign In

1. Click **⚙️ Settings** → **GitHub**
2. Click **Sign in with GitHub**
3. Authorize SK Coder (one-time)
4. Your GitHub username appears in settings

### Stage and Commit Files

1. In terminal, click **Git Panel** tab
2. Click file checkboxes to stage them
3. Write your commit message
4. Click **Commit**
5. Click **Push** to send to GitHub

### Push and Pull

- **Push** — Send your local commits to GitHub
- **Pull** — Fetch latest changes from GitHub

---

## AI Assistant Features

### Ask Questions

**Click the AI tab in the terminal:**
- "Explain how async/await works in JavaScript"
- "I'm getting this error: [paste error]. How do I fix it?"
- "Write a Python function that calculates fibonacci"
- "What's the difference between var, let, and const?"

### Get Code Fixes

When you get an error:
1. Error appears in preview pane
2. Click **"Fix with AI"** button
3. AI suggests a fix
4. Review the suggested code
5. Click **"Apply Fix"** to use it

### AI Settings

- Add your **OpenAI API key** (GPT-4 access, $0.03-$0.15 per query)
- Use **Free Puter AI** (limited, slower)
- Toggle **Auto-Context** so AI remembers your current file

---

## Troubleshooting

### "Python not ready" Error

**Problem:** Python takes 5-10 seconds to load on first run.

**Solution:**
1. Wait for "Python 3.12 ready" message
2. Try running your code again
3. Subsequent runs are instant (cached)

### Code Won't Run

**Check:**
1. No syntax errors? Click **Format** (Ctrl+Shift+F)
2. Correct language selected?
3. File saved? (auto-save every 10 seconds)
4. Terminal tab is active? (bottom pane)

### Terminal Command Not Found

```bash
$ ls                     # ✓ Works
$ grep "text" file.txt   # ✓ Works
$ npm install            # ✗ Won't work (no npm in shell)
$ node script.js         # ✗ Use terminal's Node.js tab instead
```

### Preview Blank

1. Reload the page (F5)
2. Make sure file is HTML format
3. Click **Preview** button on the right
4. Check console for JavaScript errors (F12)

### Lost Work

**Don't panic!**
- Check "recent" folder (auto-saves every 10 seconds)
- Export as ZIP periodically (settings → Storage)
- Your files are auto-backed up in IndexedDB (browser storage)

### Backend Unavailable

SK Coder automatically falls back to browser execution:
- Python runs via **Pyodide** (browser-based Python)
- JavaScript runs via **Nodebox** (browser-based Node.js)
- No code loss; everything still works

---

## Important: Data Retention & Cleanup

### 72-Hour Auto-Cleanup

- Temporary execution files are **deleted after 72 hours** of inactivity
- Your **source code remains** in your workspace indefinitely
- Only cache/temp files are removed

### Backup Your Work

We recommend:
1. Export your workspace as ZIP monthly
2. Push important projects to GitHub
3. Keep local copies of critical files

---

## Performance Tips

1. **Close unused tabs** — Each open file uses RAM
2. **Use JavaScript preview** for performance — More responsive than iframe
3. **Disable minimap** if laggy — Settings → Editor
4. **Clear terminal output** — Large logs slow down terminal
5. **Reduce file tree size** — Too many files in sidebar can lag

---

## Privacy & Security

- **Your code stays private** — Unless you push to GitHub
- **No data sharing** — We don't read or analyze your code
- **Local storage first** — Files stored in your browser initially
- **Secure backend** — Execution servers are isolated and secure

See [Privacy Policy](/privacy) for full details.

---

## Keyboard Shortcuts Cheat Sheet

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Save | Ctrl+S | Cmd+S |
| Find | Ctrl+F | Cmd+F |
| Replace | Ctrl+H | Cmd+H |
| Format Code | Ctrl+Shift+F | Cmd+Shift+F |
| Comment | Ctrl+/ | Cmd+/ |
| Duplicate Line | Ctrl+D | Cmd+D |
| Delete Line | Ctrl+Shift+K | Cmd+Shift+K |
| Move Line Up | Alt+↑ | Opt+↑ |
| Move Line Down | Alt+↓ | Opt+↓ |
| Go to Line | Ctrl+G | Cmd+G |
| Select All | Ctrl+A | Cmd+A |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Y |

---

## Support & Feedback

- **Report Bug** — Submit issue on GitHub
- **Request Feature** — Tell us what you'd like
- **Email Support** — support@skcoder.app

---

**Happy Coding!** 🚀

**SK Coder Team**
*Last Updated: August 15, 2026*

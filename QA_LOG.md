# SK Coder QA Log

## 2026-08-13 — Foundation UI validation

| Check | Result | Evidence |
|---|---|---|
| Application shell loads | Passed | The browser opened the deployed development preview with no console errors. |
| Desktop IDE layout | Passed | Top bar, file area, editor area, bottom navigation, and status bar rendered. |
| Starter workspace | Passed | `index.html` was selected and shown in the editor. |
| HTML run path | Passed | Selecting **Run** replaced the editor area with the preview surface without errors. |
| Persisted explorer state | Passed | Reloading with previous browser state no longer crashes the explorer; restored folder data is normalized to a `Set`. |
| Per-item action control | Passed | The explorer exposes an accessible **Open actions** control for the starter file, alongside right-click and long-press support. |
| Explorer actions menu | Passed | The three-dot control opens file actions for Open, Run / Preview, Share, Rename, Copy Content, Properties, and Delete. |
| ZIP import structure | Passed | A ZIP fixture containing a project folder, `src/utils/math.ts`, `assets/readme.txt`, and `index.html` retained its nested hierarchy and opened `math.ts` correctly. |
| Node.js primary executor | Passed | The Node terminal sent `console.log(6 * 7)` to Wandbox and returned `42` with exit code `0`. |
| Java primary executor | Passed | An imported `public class Main` program ran through Wandbox, returned `42`, and exited with code `0`; the runner adapts Wandbox’s fixed Java source filename without changing editor content. |
| Added terminal sessions | Passed | The add control created `Java 2` from the active terminal and exposed a close action only for that user-created session; default sessions have no close action. |
| Added terminal close | Passed | Closing `Java 2` removed the temporary session and left the default terminal list intact. |
| Explorer terminal bridge | Passed | Choosing **Open via Node.js** on a folder moved to the Node terminal, displayed the selected workspace path, and executed the bridged `ls` command. |
| Backend health and runtime metadata | Passed | The local Oracle-ready service exposed health, storage status, and runtime metadata endpoints. |
| Execution isolation guard | Passed | With Docker unavailable in this sandbox, the execution endpoint returned a controlled `503` response instead of running code on the host. |
| Temporary storage upload | Passed | A workspace snapshot upload returned `201 Created` with an expiration timestamp 72 hours after upload. |
| Backend tests | Passed | Runtime aliasing, Java source normalization, and the allowed-origin WebSocket terminal handshake passed in four automated backend tests. |
| Cleanup authorization | Passed | The cleanup endpoint correctly returned `403 Forbidden` when no administrator token was provided. |
| Problems panel | Passed | The editor now presents an in-layout Problems control and correctly reports no diagnostics for the valid Java fixture. |
| Delete confirmation | Passed | Choosing Delete on a project folder opened a confirmation dialog describing the impact; cancelling preserved the folder and its contents. |
| GitHub Codespaces API | Passed | The authenticated GitHub endpoint returned a valid Codespaces response with zero available codespaces; the client was corrected to read the current `codespaces` array response shape. |
| Settings persistence | Passed | A temporary backend URL was saved, survived a full browser reload, displayed in Storage settings, and was cleared after the isolated test. |
| Mobile responsiveness and touch targets | Passed | At 375 pixels, the editor and Files panel now use the full workspace width; mobile navigation, explorer rows, context controls, and top-bar actions expose 44-pixel-high touch targets. |
| Frontend unit tests | Passed | Six Vitest assertions covering workspace paths, preview refresh, Wandbox Java routing, and preview error forwarding passed. |
| Backend tests | Passed | Four Node tests now pass without requiring a manually started backend process, including the allowed-origin WebSocket terminal behavior. |
| Deployment artifacts | Passed with environment limitation | The Vercel configuration parses as valid JSON. Docker Compose validation is deferred to the Oracle host because Docker is unavailable in this sandbox. |
| Phase 2 workspace import | Passed | A ZIP containing nested source files and a PNG asset imported through the live Open flow. The replacement decision dialog appeared, the Explorer retained the asset folder, and the editor opened the imported `index.html` rather than a stale tab with prior workspace content. |
| Phase 2 binary preview diagnostic | Fixture issue isolated | The initial one-pixel PNG fixture was malformed and the browser correctly reported an image decoding error from its data URL. The import path retained and inlined the asset as designed; a valid fixture is required for the rendering check. |
| Phase 2 corrected binary fixture rerun | Passed | Replaced the malformed PNG fixture with a decoder-valid RGBA PNG, re-imported it using Replace, and reran the live preview. The browser error count remained at the two earlier malformed-fixture errors, confirming that the corrected imported binary asset did not introduce a new preview decoding error. |
| Phase 3 terminal tab scope | Passed | The live Local terminal exposes only Shell, Python, Node, and Bash defaults alongside the add-terminal control. Deferred C/C++, Java, Kali, and Git Bash tabs are absent. |
| Phase 3 browser virtual filesystem | Passed | In the live browser terminal, `mkdir scratch` returned `Created /scratch` and the Explorer immediately displayed the new `scratch` folder. This confirms local terminal mutations update the shared workspace without a backend runtime. |
| Phase 3 browser working directory | Passed | The live terminal accepted `cd scratch` followed by `pwd` and returned `/scratch`, confirming stateful browser-side directory navigation. |
| Phase 3 browser copy and move | Passed | The live terminal returned `Copied /app.js to /scratch/app.js` and then `Moved /scratch/app.js to /scratch/demo.js`, confirming stateful virtual filesystem copy and rename behavior. |
| Phase 3 browser search and cleanup | Passed | `grep console demo.js` returned `/scratch/demo.js:1:console.log("imported")` and `find demo` returned `/scratch/demo.js`. The test then returned to root and `rm scratch` removed the temporary folder, leaving no test artifact in the imported workspace. |
| Phase 3 Git workspace panel | Passed | The live mobile navigation exposes a Git panel. With no browser token, it safely directs the user to the existing Cloud Shell device flow and disables remote actions; the staging area lists all workspace files, including the imported PNG as a binary file. |
| Phase 3 quality gate | Passed | Lint completes with 0 errors, strict TypeScript completes with 0 errors, 11 frontend tests pass across 6 test files, and the production build succeeds. The main compressed bundle is 262.01 KB, well below the 1.5 MB requirement. |
| Phase 3 dependency cleanup | Passed | `lovable-tagger` was removed from both package metadata and lock metadata. |
| Phase 4 documentation | Passed | The rewritten User Guide contains 1,298 words, Privacy Policy 1,518 words, Terms 1,329 words, and README 1,019 words. The Privacy Policy direct route rendered successfully in the live app with 0 console errors; strict TypeScript and the production build also pass after the documentation update. |
| Phase 4 interactive guide route | Passed | The `/guide` route rendered in the live application with 0 console errors, including the command reference table and interactive troubleshooting disclosure sections. |
| Phase 4 AI key validation | Passed | Deterministic tests confirm a successful OpenAI-compatible key check stores the key, normalized endpoint, and selected model, while a rejected validation leaves no key stored. The frontend suite now contains 13 passing tests across 7 test files. |
| Phase 5 mobile 375 px layout | Passed | At 375 × 812, the editor uses the full content width, top-bar controls remain reachable, Problems remains visible, and the six-item navigation remains usable. Top-level action controls are 44–71 px tall and bottom navigation controls are 55 px tall. |
| Phase 5 tablet 768 px layout | Passed | At 768 × 1024, the persistent 256 px Explorer, 512 px editor, top bar, Problems control, status bar, and six-item bottom navigation all render without overlap or horizontal clipping. |
| Phase 5 desktop 1200 px layout | Passed | At 1200 × 900, the 256 px Explorer, 944 px editor workspace, top bar controls, status bar, and six-item navigation remain aligned with no horizontal clipping or browser-console errors. |
| Phase 5 production Lighthouse audit | Passed | Lighthouse against the optimized production preview scored 92 for Performance, 94 for Accessibility, 96 for Best Practices, and 100 for SEO. Largest Contentful Paint was 3.1 s and Total Blocking Time was 50 ms. The result followed route/panel code splitting, user-triggered Monaco enhancement loading, and accessible labels for Run and tab-close controls. |
| Phase 5 offline execution fallback | Passed | Deterministic runner tests confirm that a standalone Node.js file falls back to browser execution when Wandbox reports unavailable, while Python invokes the browser Pyodide route without relying on a backend. The frontend suite now has 15 passing tests across 8 files. |
| Phase 5 optimized editor loading | Passed | A live reload rendered the editable lightweight browser editor immediately with the imported workspace content and an explicit “Enable enhanced editor” action. Run and tab-close controls now expose accessible names in the live accessibility tree. |
| Phase 5 enhanced editor loading | Passed | Selecting “Enable enhanced editor” loaded the Monaco editor surface on demand with the workspace content intact and no new browser-console errors. |

The console reported two non-blocking warnings and no errors during the successful checks.

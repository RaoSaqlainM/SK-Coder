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

The console reported two non-blocking warnings and no errors during the successful checks.

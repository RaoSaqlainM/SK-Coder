let runtime: { runPythonAsync: (source: string) => Promise<unknown>; setStdout: (handler: { batched: (value: string) => void }) => void; setStderr: (handler: { batched: (value: string) => void }) => void } | null = null

export async function runPython(source: string, output: (text: string) => void) {
  if (!runtime) {
    const module = await import("pyodide")
    runtime = await module.loadPyodide({ indexURL: "/pyodide/" }) as typeof runtime
  }
  runtime.setStdout({ batched: output })
  runtime.setStderr({ batched: output })
  await runtime.runPythonAsync(source)
}

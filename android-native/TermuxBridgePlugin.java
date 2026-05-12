package app.lovable.fbf8d1fcf2504b7699cb7af913d34b5a.termux;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "TermuxBridge")
public class TermuxBridgePlugin extends Plugin {

    private static final String TERMUX_PKG = "com.termux";
    private static final String TERMUX_RUN_SERVICE = "com.termux.app.RunCommandService";
    private static final String TERMUX_RUN_ACTION = "com.termux.RUN_COMMAND";
    private static final String TERMUX_OUTPUT_DIR = "/data/data/com.termux/files/home/.skcoder-output";

    @PluginMethod
    public void isInstalled(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            pm.getPackageInfo(TERMUX_PKG, 0);
            ret.put("installed", true);
        } catch (PackageManager.NameNotFoundException e) {
            ret.put("installed", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstall(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://f-droid.org/en/packages/com.termux/"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void runCommand(PluginCall call) {
        String command = call.getString("command", "");
        com.getcapacitor.JSArray argsArr = call.getArray("args");
        String cwd = call.getString("cwd", "/data/data/com.termux/files/home");
        boolean background = Boolean.TRUE.equals(call.getBoolean("background", false));

        List<String> args = new ArrayList<>();
        if (argsArr != null) {
            try {
                for (int i = 0; i < argsArr.length(); i++) args.add(argsArr.getString(i));
            } catch (Exception ignored) {}
        }

        String runId = UUID.randomUUID().toString();
        File outDir = new File(TERMUX_OUTPUT_DIR);
        if (!outDir.exists()) outDir.mkdirs();
        File stdoutFile = new File(outDir, runId + ".out");
        File stderrFile = new File(outDir, runId + ".err");

        Intent intent = new Intent();
        intent.setClassName(TERMUX_PKG, TERMUX_RUN_SERVICE);
        intent.setAction(TERMUX_RUN_ACTION);
        intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/" + command);
        intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", args.toArray(new String[0]));
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", cwd);
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", background);
        intent.putExtra("com.termux.RUN_COMMAND_STDOUT", stdoutFile.getAbsolutePath());
        intent.putExtra("com.termux.RUN_COMMAND_STDERR", stderrFile.getAbsolutePath());

        try {
            getContext().startService(intent);
        } catch (Exception e) {
            call.reject("Failed to call Termux: " + e.getMessage()
                + ". Make sure Termux is installed and allow-external-apps=true is in ~/.termux/termux.properties");
            return;
        }

        new Thread(() -> {
            int waited = 0;
            while (!stdoutFile.exists() && !stderrFile.exists() && waited < 60000) {
                try { Thread.sleep(500); } catch (InterruptedException ignored) {}
                waited += 500;
            }
            try { Thread.sleep(500); } catch (InterruptedException ignored) {}
            JSObject ret = new JSObject();
            ret.put("stdout", readFile(stdoutFile));
            ret.put("stderr", readFile(stderrFile));
            ret.put("exitCode", stdoutFile.exists() || stderrFile.exists() ? 0 : 1);
            stdoutFile.delete();
            stderrFile.delete();
            call.resolve(ret);
        }).start();
    }

    private String readFile(File f) {
        if (!f.exists()) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String line; while ((line = r.readLine()) != null) sb.append(line).append("\n");
        } catch (Exception ignored) {}
        return sb.toString();
    }
}

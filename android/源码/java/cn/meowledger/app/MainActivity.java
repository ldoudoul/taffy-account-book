package cn.meowledger.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.AtomicFile;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

/** Offline app assets, atomic private ledger, and user-selected document access. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int SAVE = 101, OPEN = 102, LIMIT = 16 * 1024 * 1024;
    private final Object ledgerLock = new Object();
    private WebView web;
    private AtomicFile ledger;
    private ValueCallback<Uri[]> chooser;
    private String saveId;
    private byte[] saveBytes;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ledger = new AtomicFile(new File(getFilesDir(), "ledger.json"));
        getWindow().setStatusBarColor(Color.rgb(252, 250, 251));
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return insets;
            });
        } else root.setFitsSystemWindows(true);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setBackgroundColor(Color.rgb(252, 250, 251));
        web.addJavascriptInterface(new LedgerBridge(), "MeowAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!trusted(url) || !"GET".equals(request.getMethod())) return unavailable();
                String path = url.getPath().substring("/assets/".length());
                if (path.isEmpty() || path.contains("..") || path.contains("\\")) return unavailable();
                try {
                    return new WebResourceResponse(mime(path), "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("web/" + path));
                } catch (Exception error) { return unavailable(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !trusted(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent, OPEN); }
                catch (Exception error) { chooser.onReceiveValue(null); chooser = null; showError("无法打开文件选择器"); }
                return true;
            }
        });
        web.loadUrl("https://" + HOST + "/assets/index.html?android=1#home");
    }

    private static boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1
            && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }
    private static WebResourceResponse unavailable() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
            new ByteArrayInputStream("Local resource unavailable".getBytes(StandardCharsets.UTF_8)));
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/json";
    }
    private static byte[] readLimited(InputStream input) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = input.read(buffer)) != -1) {
            if (out.size() + count > LIMIT) throw new IllegalArgumentException("文件不能超过16MB");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }

    public class LedgerBridge {
        @JavascriptInterface public String loadLedger() {
            synchronized (ledgerLock) {
                if (!ledger.getBaseFile().exists() && !new File(ledger.getBaseFile() + ".bak").exists()) return null;
                try (InputStream input = ledger.openRead()) { return new String(readLimited(input), StandardCharsets.UTF_8); }
                catch (Exception error) { return "{\"storageReadError\":true}"; }
            }
        }
        @JavascriptInterface public boolean saveLedger(String raw, String expected) {
            synchronized (ledgerLock) {
                FileOutputStream output = null;
                try {
                    if (raw == null || raw.getBytes(StandardCharsets.UTF_8).length > LIMIT) return false;
                    String old = loadLedger();
                    if ("{\"storageReadError\":true}".equals(old)) return false;
                    if (!(old == null ? expected == null || expected.isEmpty() : old.equals(expected))) return false;
                    JSONObject state = new JSONObject(raw);
                    if (state.getInt("version") != 1 || state.getJSONArray("transactions").length() > 50000) return false;
                    state.getJSONObject("budgets"); state.getJSONObject("settings");
                    output = ledger.startWrite();
                    output.write(raw.getBytes(StandardCharsets.UTF_8));
                    ledger.finishWrite(output);
                    return true;
                } catch (Exception error) { if (output != null) ledger.failWrite(output); return false; }
            }
        }
        @JavascriptInterface public void exportFile(String id, String content, String filename, String type) {
            if (id == null || !id.matches("[0-9a-z-]{1,64}") || content == null) return;
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > LIMIT || !("application/json".equals(type) || "text/csv".equals(type))) {
                resolve(id, false, "导出内容无效或超过16MB"); return;
            }
            runOnUiThread(() -> {
                if (saveId != null) { resolve(id, false, "请先完成当前文件保存"); return; }
                saveId = id; saveBytes = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(type);
                intent.putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[/\\\\]", "_"));
                try { startActivityForResult(intent, SAVE); }
                catch (Exception error) { saveId = null; saveBytes = null; resolve(id, false, "无法打开文件保存器"); }
            });
        }
    }
    private void resolve(String id, boolean saved, String error) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.meowAndroidResult?.(" + JSONObject.quote(id) + ","
                + saved + "," + JSONObject.quote(error == null ? "" : error) + ")", null);
        });
    }
    private void showError(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == OPEN && chooser != null) {
            chooser.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            chooser = null;
        }
        if (code == SAVE && saveId != null) {
            String id = saveId; byte[] bytes = saveBytes; saveId = null; saveBytes = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { resolve(id, false, ""); return; }
            Uri uri = data.getData();
            new Thread(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IllegalStateException();
                    out.write(bytes); out.flush(); resolve(id, true, "");
                } catch (Exception error) { resolve(id, false, "文件保存失败，请重新选择保存位置"); }
            }, "MeowExport").start();
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(()=>{const m=document.getElementById('modal');if(m?.open){if(!m.querySelector('button:disabled'))m.close();return 'modal';}if(location.hash!=='#home'){location.hash='home';return 'home';}return 'exit';})()",
            value -> { if ("\"exit\"".equals(value)) super.onBackPressed(); });
    }
    @Override protected void onPause() { if (web != null) { web.onPause(); web.pauseTimers(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.resumeTimers(); } }
    @Override protected void onDestroy() {
        if (chooser != null) chooser.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("MeowAndroid"); web.destroy(); web = null; }
        super.onDestroy();
    }
}

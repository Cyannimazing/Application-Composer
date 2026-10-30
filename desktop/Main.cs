using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Application Composer")]
[assembly: AssemblyDescription("Standalone Application Composer desktop application")]
[assembly: AssemblyProduct("Application Composer")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

namespace ApplicationComposerDesktop
{
    internal static class Program
    {
        internal const string Url = "http://127.0.0.1:32187";
        internal const string MutexName = "Local\\ApplicationComposer-Standalone";
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
        [STAThread]
        private static int Main(string[] args)
        {
            AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
            AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
            bool smoke = args.Length == 1 && args[0] == "--smoke-test";
            try
            {
                bool first;
                using (var mutex = new Mutex(true, MutexName, out first))
                {
                    if (!first)
                    {
                        if (smoke) throw new InvalidOperationException("Close the desktop window before running its startup test.");
                        using (var reopen = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\ApplicationComposer-Show")) reopen.Set();
                        return 0;
                    }
                    try
                    {
                        AppBundle.RegisterAssemblies();
                        if (smoke) { string root = AppBundle.Install(); AppBundle.MigrateProfile(); return Smoke(root); }
                        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                        using (var reopen = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\ApplicationComposer-Show"))
                        using (var window = CreateWindow())
                        {
                            var registration = ThreadPool.RegisterWaitForSingleObject(reopen, (state, timedOut) => { try { window.BeginInvoke(new Action(() => { window.Show(); window.WindowState = FormWindowState.Normal; window.Activate(); })); } catch (InvalidOperationException) { } }, null, Timeout.Infinite, false);
                            try { Application.Run(window); } finally { registration.Unregister(null); }
                        }
                    }
                    finally { mutex.ReleaseMutex(); }
                }
                return 0;
            }
            catch (Exception error)
            {
                if (smoke) Console.Error.WriteLine(error.Message);
                else MessageBox.Show(error.Message, "Application Composer", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
        [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
        private static Form CreateWindow() { return new ComposerWindow(); }
        private static int Smoke(string root)
        {
            using (var server = new LauncherServer(AppBundle.Server(root)))
            {
                if (ServerProbe.Check(Url).GetAwaiter().GetResult() != ServerState.Offline) throw new InvalidOperationException("Close the existing browser/dev server once before starting the standalone app. The desktop window will manage startup and shutdown after that.");
                server.EnsureStarted(Path.Combine(AppBundle.Home, "launcher.log")).GetAwaiter().GetResult();
                if (!server.OwnsServer) throw new InvalidOperationException("A different server started during launch. Close it and retry.");
                Console.WriteLine("PASS: bundled Node and standalone app are ready; closing stops the owned server.");
            }
            return 0;
        }
        internal static void OpenExternal(string value)
        {
            Uri url;
            if (Uri.TryCreate(value, UriKind.Absolute, out url) && (url.Scheme == "http" || url.Scheme == "https")) Process.Start(new ProcessStartInfo(url.AbsoluteUri) { UseShellExecute = true });
        }
    }

    internal sealed class ComposerWindow : Form
    {
        private readonly Label loading;
        private LauncherServer server;
        private WebView2 view;
        private bool closing;
        private readonly NotifyIcon tray;
        private readonly System.Windows.Forms.Timer monitor = new System.Windows.Forms.Timer { Interval = 1000 };
        public ComposerWindow()
        {
            Directory.CreateDirectory(AppBundle.Home);
            File.WriteAllText(Path.Combine(AppBundle.Home, "desktop-window.log"), "Window created\n");
            Text = "Application Composer"; Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            StartPosition = FormStartPosition.CenterScreen; Size = new Size(1360, 900); MinimumSize = new Size(840, 620);
            BackColor = Color.FromArgb(243, 244, 246);
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open Application Composer", null, (s, e) => RestoreWindow());
            menu.Items.Add("Hide to tray", null, (s, e) => { WindowState = FormWindowState.Minimized; });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, (s, e) => Close());
            tray = new NotifyIcon { Icon = Icon, Text = "Application Composer", Visible = true, ContextMenuStrip = menu };
            tray.DoubleClick += (s, e) => RestoreWindow();
            Resize += (s, e) => { if (!closing && WindowState == FormWindowState.Minimized) { Hide(); Log("Hidden in system tray; server stays running"); } };
            loading = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Text = "Starting Application Composer...", Font = new Font("Segoe UI", 13) }; Controls.Add(loading);
            Shown += async (s, e) => await Start();
            monitor.Tick += (s, e) =>
            {
                if (!closing && server != null && server.OwnedServerExited) { monitor.Stop(); MessageBox.Show("The local app stopped. Reopen Application Composer to restart it. Log: " + Path.Combine(AppBundle.Home, "launcher.log"), Text); Close(); }
            };
            FormClosed += (s, e) => { closing = true; tray.Visible = false; tray.Dispose(); monitor.Stop(); monitor.Dispose(); if (view != null) view.Dispose(); if (server != null) server.Dispose(); Log("Window closed; owned server stopped"); };
        }
        private async Task Start()
        {
            try
            {
                loading.Text = "Preparing Application Composer...";
                string root = await Task.Run(() => { string installed = AppBundle.Install(); AppBundle.MigrateProfile(); return installed; });
                if (closing) return;
                loading.Text = "Starting Application Composer...";
                server = new LauncherServer(AppBundle.Server(root));
                if (await ServerProbe.Check(Program.Url) != ServerState.Offline) throw new InvalidOperationException("The old browser/dev server is still running. Close its terminal once, then reopen this app. Closing the desktop window will then shut down its server automatically.");
                await server.EnsureStarted(Path.Combine(AppBundle.Home, "launcher.log"));
                if (!server.OwnsServer) throw new InvalidOperationException("A different server started during launch. Close it and reopen Application Composer.");
                Log("Owned server ready");
                if (closing) return;
                CoreWebView2Environment.SetLoaderDllFolderPath(root);
                var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppBundle.Home, "browser"));
                if (closing) return;
                view = new WebView2 { Dock = DockStyle.Fill }; Controls.Add(view); view.BringToFront();
                await view.EnsureCoreWebView2Async(environment);
                Log("WebView initialized");
                if (closing) return;
                view.CoreWebView2.WebMessageReceived += ForwardBrowserAction;
                view.CoreWebView2.NavigationCompleted += (s, e) => Log(e.IsSuccess ? "Application UI loaded" : "Navigation failed: " + e.WebErrorStatus);
                await view.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"(() => {
                    const origin = 'http://127.0.0.1:32187'; let available = false;
                    const announce = async () => { try { const state = await (await fetch(origin + '/api/state')).json(); if (state.extensionSeen > 0) { available = true; window.postMessage({ source: 'application-composer-companion', action: 'ready' }, origin); } } catch {} };
                    window.addEventListener('message', event => { if (event.source !== window || event.origin !== origin || event.data?.source !== 'application-composer-app') return; if (event.data.action === 'ping') void announce(); if (available && ['fill','draft-session'].includes(event.data.action)) window.chrome.webview.postMessage(event.data); });
                    setInterval(announce,2500); void announce();
                })();");
                view.CoreWebView2.NewWindowRequested += (s, e) => { e.Handled = true; Program.OpenExternal(e.Uri); };
                view.CoreWebView2.NavigationStarting += (s, e) => { if (!e.Uri.StartsWith(Program.Url + "/", StringComparison.OrdinalIgnoreCase)) { e.Cancel = true; Program.OpenExternal(e.Uri); } };
                view.Source = new Uri(Program.Url); loading.Visible = false; monitor.Start();
            }
            catch (Exception error)
            {
                Log("Startup error: " + error);
                if (closing) return;
                MessageBox.Show(error.Message + "\n\nIf WebView2 is missing, install Microsoft Edge WebView2 Runtime. Log: " + Path.Combine(AppBundle.Home, "launcher.log"), Text, MessageBoxButtons.OK, MessageBoxIcon.Error); Close();
            }
        }
        private static void Log(string message) { try { File.AppendAllText(Path.Combine(AppBundle.Home, "desktop-window.log"), DateTime.UtcNow.ToString("s") + " " + message + "\n"); } catch { } }
        private void RestoreWindow() { Show(); WindowState = FormWindowState.Normal; Activate(); Log("Restored from system tray"); }
        private async void ForwardBrowserAction(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (!args.Source.StartsWith(Program.Url + "/", StringComparison.OrdinalIgnoreCase)) return;
            try
            {
                var data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(args.WebMessageAsJson);
                if (Convert.ToString(data["source"]) != "application-composer-app") return;
                string action = Convert.ToString(data["action"]), query = "";
                foreach (string key in action == "fill" ? new[] { "commandId" } : action == "draft-session" ? new[] { "jobId", "captureId" } : new string[0])
                {
                    string value = Convert.ToString(data[key]); if (!Regex.IsMatch(value, @"^[A-Za-z0-9_-]{1,100}$")) return;
                    query += "&" + key + "=" + Uri.EscapeDataString(value);
                }
                if (query.Length == 0) return;
                Program.OpenExternal(Program.Url + "/api/desktop/bridge?operation=" + action + query);
                if (action == "draft-session") { await Task.Delay(1200); if (!closing) Activate(); }
            }
            catch (Exception error) { if (!closing) MessageBox.Show("The browser companion could not receive this action: " + error.Message, Text); }
        }
    }
}

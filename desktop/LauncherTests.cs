using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.IO.Compression;

namespace ApplicationComposerDesktop
{
    internal static class LauncherTests
    {
        public static int Main(string[] args)
        {
            AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
            AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
            if (args.Length > 0 && args[0] == "--host")
            {
                var hosted = new ServerSpec { Root = Path.GetDirectoryName(args[2]), Node = args[1], Url = "http://127.0.0.1:" + args[3], Arguments = new[] { args[2], args[3], "composer", args[4] } };
                using (var controller = new LauncherServer(hosted))
                {
                    controller.EnsureStarted(args[5]).GetAwaiter().GetResult();
                    File.WriteAllText(args[6], "ready"); Thread.Sleep(Timeout.Infinite);
                }
                return 0;
            }
            string root = Path.Combine(Path.GetTempPath(), "composer desktop test " + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                using (var archiveData = new MemoryStream())
                {
                    using (var archive = new ZipArchive(archiveData, ZipArchiveMode.Create, true)) { using (var writer = new StreamWriter(archive.CreateEntry("../outside.txt").Open())) writer.Write("unsafe"); }
                    archiveData.Position = 0; bool escaped = false;
                    try { AppBundle.Extract(archiveData, Path.Combine(root, "package")); } catch (InvalidOperationException) { escaped = true; }
                    Check(escaped && !File.Exists(Path.Combine(root, "outside.txt")), "Bundle extraction must reject path traversal.");
                }
                string previousHome = Environment.GetEnvironmentVariable("COMPOSER_DESKTOP_HOME");
                try
                {
                    Environment.SetEnvironmentVariable("COMPOSER_DESKTOP_HOME", Path.Combine(root, "app home"));
                    string legacy = Path.Combine(BuildConfig.SourceRoot, ".local"); Directory.CreateDirectory(legacy);
                    File.WriteAllText(Path.Combine(legacy, "profile.json"), "{\"name\":\"Fixture\"}");
                    File.WriteAllText(Path.Combine(legacy, "credentials.txt"), "must-not-migrate");
                    AppBundle.MigrateProfile();
                    string migrated = Path.Combine(AppBundle.Data, "profile.json");
                    Check(File.ReadAllText(migrated).Contains("Fixture") && !File.Exists(Path.Combine(AppBundle.Data, "credentials.txt")), "Migration must copy only allowlisted app data.");
                    File.WriteAllText(migrated, "{\"name\":\"Edited\"}"); AppBundle.MigrateProfile();
                    Check(File.ReadAllText(migrated).Contains("Edited"), "Reopening must preserve newer profile edits.");
                }
                finally { Environment.SetEnvironmentVariable("COMPOSER_DESKTOP_HOME", previousHome); }
                Console.WriteLine("PASS: safe bundle extraction and one-time allowlisted profile migration preserve user edits.");
                bool rejected = false;
                try { Installation.Validate(root, args[0]); }
                catch (InvalidOperationException error) { rejected = error.Message.Contains("desktop:build"); }
                if (!rejected) throw new Exception("FAIL: missing production build must be rejected with the rebuild command.");
                Console.WriteLine("PASS: a missing production build is rejected with a fix.");
                Directory.CreateDirectory(Path.Combine(root, "node_modules", "next", "dist", "bin"));
                Directory.CreateDirectory(Path.Combine(root, ".next"));
                File.WriteAllText(Path.Combine(root, "package.json"), "{}");
                File.WriteAllText(Path.Combine(root, "node_modules", "next", "dist", "bin", "next"), "fixture");
                File.WriteAllText(Path.Combine(root, ".next", "BUILD_ID"), "old-web-build");
                rejected = false;
                try { Installation.Validate(root, args[0]); } catch (InvalidOperationException) { rejected = true; }
                Check(rejected, "A normal .next build must not substitute for the isolated desktop build.");
                Directory.CreateDirectory(Path.Combine(root, ".next-desktop"));
                File.WriteAllText(Path.Combine(root, ".next-desktop", "BUILD_ID"), "desktop-build");
                Installation.Validate(root, args[0]);
                Console.WriteLine("PASS: the launcher requires its isolated desktop production build.");
                string fixture = Path.Combine(root, "fixture server.js");
                File.WriteAllText(fixture, "const http=require('http'),fs=require('fs'),{spawn}=require('child_process');const [port,mode,pidFile]=process.argv.slice(2);if(pidFile){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(pidFile,String(child.pid));}http.createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({application:mode==='other'?'unrelated-app':'application-composer',ready:true}));}).listen(+port,'127.0.0.1');");
                int port = FreePort();
                var spec = new ServerSpec { Root = root, Node = args[0], Url = "http://127.0.0.1:" + port, Arguments = new[] { fixture, port.ToString(), "composer" } };
                using (var external = Fixture(args[0], fixture, port, "composer"))
                {
                    try {
                    WaitReady(spec.Url);
                    using (var launcher = new LauncherServer(spec))
                    {
                        launcher.EnsureStarted(Path.Combine(root, "reuse.log")).GetAwaiter().GetResult();
                        Check(!launcher.OwnsServer, "Reusing a server must not take ownership.");
                    }
                    Check(!external.HasExited, "Disposing a launcher must preserve an external server.");
                    } finally { if (!external.HasExited) external.Kill(); external.WaitForExit(3000); }
                }
                Console.WriteLine("PASS: existing Composer servers are reused and never stopped.");
                port = FreePort(); spec.Url = "http://127.0.0.1:" + port;
                using (var external = Fixture(args[0], fixture, port, "other"))
                {
                    try {
                    WaitState(spec.Url, ServerState.Other);
                    bool refused = false;
                    using (var launcher = new LauncherServer(spec))
                    {
                        try { launcher.EnsureStarted(Path.Combine(root, "conflict.log")).GetAwaiter().GetResult(); }
                        catch (InvalidOperationException error) { refused = error.Message.Contains("occupied"); }
                    }
                    Check(refused && !external.HasExited, "An unrelated listener must be refused and preserved.");
                    } finally { if (!external.HasExited) external.Kill(); external.WaitForExit(3000); }
                }
                Console.WriteLine("PASS: unrelated listeners are rejected without termination.");
                port = FreePort(); string childFile = Path.Combine(root, "child.pid");
                spec.Url = "http://127.0.0.1:" + port;
                spec.Arguments = new[] { fixture, port.ToString(), "composer", childFile };
                int childId;
                using (var launcher = new LauncherServer(spec))
                {
                    launcher.EnsureStarted(Path.Combine(root, "owned.log")).GetAwaiter().GetResult();
                    Check(launcher.OwnsServer, "A started server must be owned.");
                    for (int i = 0; i < 60 && !File.Exists(childFile); i++) Thread.Sleep(100);
                    childId = Int32.Parse(File.ReadAllText(childFile));
                    Check(Running(childId), "Fixture child must exist before cleanup is checked.");
                }
                WaitState(spec.Url, ServerState.Offline);
                for (int i = 0; i < 30 && Running(childId); i++) Thread.Sleep(100);
                Check(!Running(childId), "Owned server descendants must exit with the launcher.");
                Console.WriteLine("PASS: owned server and descendant processes stop together; paths with spaces work.");
                port = FreePort(); string abruptPid = Path.Combine(root, "abrupt-child.pid"), readyFile = Path.Combine(root, "host.ready");
                string[] hostArgs = { "--host", args[0], fixture, port.ToString(), abruptPid, Path.Combine(root, "abrupt.log"), readyFile };
                string command = ""; foreach (string argument in hostArgs) command += LauncherServer.Quote(argument) + " ";
                using (var host = Process.Start(new ProcessStartInfo(System.Reflection.Assembly.GetExecutingAssembly().Location, command) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden }))
                {
                    try
                    {
                        for (int i = 0; i < 80 && !File.Exists(readyFile) && !host.HasExited; i++) Thread.Sleep(100);
                        Check(File.Exists(readyFile), "Abrupt-exit fixture host must become ready.");
                        childId = Int32.Parse(File.ReadAllText(abruptPid));
                        host.Kill(); host.WaitForExit(3000);
                        WaitState("http://127.0.0.1:" + port, ServerState.Offline);
                        for (int i = 0; i < 30 && Running(childId); i++) Thread.Sleep(100);
                        Check(!Running(childId), "Killing the launcher must also stop its immediate-spawn descendant.");
                    }
                    finally { if (!host.HasExited) { host.Kill(); host.WaitForExit(3000); } }
                }
                Console.WriteLine("PASS: abrupt launcher termination also stops immediate-spawn descendants.");
                if (args.Length > 1 && File.Exists(Path.Combine(args[1], ".next-desktop", "BUILD_ID")))
                {
                    port = FreePort(); var production = ServerSpec.Production(args[1], args[0]);
                    production.Arguments[production.Arguments.Length - 1] = port.ToString();
                    using (var productionJob = ProcessJob.Create())
                    using (var productionProcess = NativeProcess.Start(production, productionJob, Path.Combine(root, "production.log")))
                    {
                        bool ready = false;
                        for (int i = 0; i < 80 && !productionProcess.HasExited; i++)
                        {
                            try
                            {
                                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/desktop/status");
                                request.Host = "127.0.0.1:32187"; request.Proxy = null; request.Timeout = 1500;
                                using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) ready = reader.ReadToEnd().Contains("\"application\":\"application-composer\"");
                            }
                            catch (WebException) { }
                            if (ready) break; Thread.Sleep(250);
                        }
                        Check(ready, "The actual isolated production build must serve its guarded readiness endpoint.");
                        var pageRequest = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/"); pageRequest.Proxy = null; pageRequest.Timeout = 10000;
                        using (var response = pageRequest.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) Check(reader.ReadToEnd().Contains("<title>Application Composer</title>"), "The production UI must render.");
                        productionJob.Dispose(); Check(productionProcess.WaitForExit(5000), "The production server must stop with its owned job.");
                    }
                    Console.WriteLine("PASS: actual isolated production server renders the app and readiness API, then stops; the user's app port is untouched.");
                }
                else Console.WriteLine("SKIP: production smoke test needs pnpm desktop:build first.");
                return 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
            finally
            {
                string parent = Path.GetDirectoryName(Path.GetFullPath(root));
                if (String.Equals(parent, Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) && Path.GetFileName(root).StartsWith("composer desktop test ")) Directory.Delete(root, true);
            }
        }
        private static void Check(bool passed, string message) { if (!passed) throw new Exception("FAIL: " + message); }
        private static int FreePort() { var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); int port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop(); return port; }
        private static bool Running(int pid) { try { using (var process = Process.GetProcessById(pid)) return !process.HasExited; } catch (ArgumentException) { return false; } }
        private static Process Fixture(string node, string script, int port, string mode)
        {
            return Process.Start(new ProcessStartInfo(node, LauncherServer.Quote(script) + " " + port + " " + mode) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
        }
        private static void WaitReady(string url) { WaitState(url, ServerState.Composer); }
        private static void WaitState(string url, ServerState state)
        {
            for (int i = 0; i < 50; i++) { if (ServerProbe.Check(url).GetAwaiter().GetResult() == state) return; Thread.Sleep(100); }
            throw new Exception("FAIL: fixture did not reach expected server state: " + state);
        }
    }
}

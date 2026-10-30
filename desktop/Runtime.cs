using System;
using System.IO;
using System.Collections.Generic;
using System.Collections;
using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

namespace ApplicationComposerDesktop
{
    internal static class Installation
    {
        public static void Validate(string root, string node)
        {
            if (!File.Exists(Path.Combine(root, "package.json")) ||
                !File.Exists(Path.Combine(root, "node_modules", "next", "dist", "bin", "next")) ||
                !File.Exists(Path.Combine(root, ".next-desktop", "BUILD_ID")))
                throw new InvalidOperationException("The local app is missing or has not been built. Open the project folder and run pnpm desktop:install (or pnpm desktop:build to build without installing).");
            if (!File.Exists(node)) throw new InvalidOperationException("Node.js was not found. Install Node.js 22 or newer, then rebuild with pnpm desktop:install (or pnpm desktop:build to build without installing).");
        }

        public static string ResolveNode(string fallback)
        {
            foreach (string folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
            {
                if (String.IsNullOrWhiteSpace(folder)) continue;
                try { string file = Path.Combine(folder.Trim('"'), "node.exe"); if (File.Exists(file)) return Path.GetFullPath(file); }
                catch (ArgumentException) { }
            }
            return fallback;
        }
    }

    internal sealed class ServerSpec
    {
        public string Node, Root, Url;
        public string[] Arguments;
        public Dictionary<string, string> Environment = new Dictionary<string, string>();
        public static ServerSpec Production(string root, string node)
        {
            return new ServerSpec { Root = root, Node = node, Url = "http://127.0.0.1:32187", Arguments = new[] { Path.Combine(root, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", "32187" } };
        }
    }

    internal enum ServerState { Offline, Composer, Other, Starting }

    internal static class ServerProbe
    {
        public static Task<ServerState> Check(string url)
        {
            return Task.Run(() =>
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create(url + "/api/desktop/status");
                    request.Proxy = null; request.Timeout = 1200; request.ReadWriteTimeout = 1200; request.AllowAutoRedirect = false;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        char[] buffer = new char[4097]; int size = 0, read;
                        while (size < buffer.Length && (read = reader.Read(buffer, size, buffer.Length - size)) > 0) size += read;
                        if (size > 4096 || response.StatusCode != HttpStatusCode.OK) return ServerState.Other;
                        var value = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(new string(buffer, 0, size));
                        object app, ready;
                        return value != null && value.TryGetValue("application", out app) && Convert.ToString(app) == "application-composer" && value.TryGetValue("ready", out ready) && ready is bool && (bool)ready ? ServerState.Composer : ServerState.Other;
                    }
                }
                catch (Exception error)
                {
                    try
                    {
                        var uri = new Uri(url);
                        using (var client = new TcpClient())
                        {
                            var connection = client.ConnectAsync(uri.Host, uri.Port);
                            if (connection.Wait(400) && client.Connected) return error is WebException && ((WebException)error).Status == WebExceptionStatus.Timeout ? ServerState.Starting : ServerState.Other;
                        }
                    }
                    catch { }
                    return ServerState.Offline;
                }
            });
        }
    }

    internal sealed class ProcessJob : SafeHandleZeroOrMinusOneIsInvalid
    {
        private ProcessJob() : base(true) { }
        [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
        {
            public long ProcessTime, JobTime;
            public uint Flags;
            public UIntPtr MinWorkingSet, MaxWorkingSet;
            public uint ActiveProcesses;
            public UIntPtr Affinity;
            public uint Priority, Scheduling;
        }
        [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
        [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
        {
            public BasicLimits Basic;
            public IoCounters Io;
            public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern ProcessJob CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(ProcessJob job, int infoClass, ref ExtendedLimits limits, uint length);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
        public static ProcessJob Create()
        {
            var job = CreateJobObject(IntPtr.Zero, null);
            if (job.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not create the server process container.");
            var limits = new ExtendedLimits(); limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))))
            { int error = Marshal.GetLastWin32Error(); job.Dispose(); throw new Win32Exception(error, "Could not enable server cleanup."); }
            return job;
        }
        protected override bool ReleaseHandle() { return CloseHandle(handle); }
    }

    internal static class NativeProcess
    {
        [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo
        {
            public int Size; public string Reserved, Desktop, Title;
            public uint X, Y, Width, Height, XChars, YChars, Fill, Flags;
            public ushort Show, ReservedLength; public IntPtr ReservedData, Input, Output, Error;
        }
        [StructLayout(LayoutKind.Sequential)] private struct StartupInfoEx { public StartupInfo Startup; public IntPtr Attributes; }
        [StructLayout(LayoutKind.Sequential)] private struct ProcessInfo { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeFileHandle CreateFile(string name, uint access, uint share, ref SecurityAttributes attributes, uint disposition, uint flags, IntPtr template);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returnedSize);
        [DllImport("kernel32.dll")] private static extern void DeleteProcThreadAttributeList(IntPtr list);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfoEx startup, out ProcessInfo process);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll")] private static extern bool TerminateProcess(IntPtr process, uint code);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);

        public static Process Start(ServerSpec spec, ProcessJob job, string logPath)
        {
            var security = new SecurityAttributes { Length = Marshal.SizeOf(typeof(SecurityAttributes)), Inherit = true };
            using (var output = CreateFile(logPath, 0x40000000, 3, ref security, 2, 0x80, IntPtr.Zero))
            using (var input = CreateFile("NUL", 0x80000000, 3, ref security, 3, 0x80, IntPtr.Zero))
            {
                if (output.IsInvalid || input.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not open the launcher log or standard input.");
                IntPtr size = IntPtr.Zero, attributes = IntPtr.Zero, handles = IntPtr.Zero, jobValue = IntPtr.Zero, environment = IntPtr.Zero;
                bool initialized = false; var native = new ProcessInfo(); Process result = null;
                try
                {
                    InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
                    attributes = Marshal.AllocHGlobal(size);
                    if (!InitializeProcThreadAttributeList(attributes, 2, 0, ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
                    initialized = true;
                    handles = Marshal.AllocHGlobal(IntPtr.Size * 2);
                    Marshal.WriteIntPtr(handles, output.DangerousGetHandle()); Marshal.WriteIntPtr(handles, IntPtr.Size, input.DangerousGetHandle());
                    if (!UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x20002), handles, new IntPtr(IntPtr.Size * 2), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
                    jobValue = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobValue, job.DangerousGetHandle());
                    // JOB_LIST assigns ownership at creation; even termination before ResumeThread cannot orphan Node.
                    if (!UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x2000D), jobValue, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows 10 or newer is required for safe server ownership.");
                    var values = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables()) values[(string)entry.Key] = (string)entry.Value;
                    values["NEXT_TELEMETRY_DISABLED"] = "1"; values["NODE_ENV"] = "production"; values["COMPOSER_DESKTOP_BUILD"] = "1";
                    foreach (var item in spec.Environment) values[item.Key] = item.Value;
                    var block = new StringBuilder(); foreach (var item in values) block.Append(item.Key).Append('=').Append(item.Value).Append('\0'); block.Append('\0');
                    environment = Marshal.StringToHGlobalUni(block.ToString());
                    var command = new StringBuilder(LauncherServer.Quote(spec.Node)); foreach (string argument in spec.Arguments) command.Append(' ').Append(LauncherServer.Quote(argument));
                    var startup = new StartupInfoEx(); startup.Startup.Size = Marshal.SizeOf(typeof(StartupInfoEx)); startup.Attributes = attributes;
                    startup.Startup.Flags = 0x100; startup.Startup.Input = input.DangerousGetHandle(); startup.Startup.Output = output.DangerousGetHandle(); startup.Startup.Error = output.DangerousGetHandle();
                    const uint flags = 0x08000000 | 0x00000400 | 0x00080000 | 0x00000004; // no window, Unicode env, extended startup, suspended
                    if (!CreateProcess(spec.Node, command, IntPtr.Zero, IntPtr.Zero, true, flags, environment, spec.Root, ref startup, out native)) throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not start the local server. Verify Node.js and rebuild the desktop launcher.");
                    result = Process.GetProcessById((int)native.ProcessId);
                    if (ResumeThread(native.Thread) == UInt32.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not resume the contained server.");
                    return result;
                }
                catch { if (native.Process != IntPtr.Zero) TerminateProcess(native.Process, 1); if (result != null) result.Dispose(); throw; }
                finally
                {
                    if (native.Thread != IntPtr.Zero) CloseHandle(native.Thread); if (native.Process != IntPtr.Zero) CloseHandle(native.Process);
                    if (initialized) DeleteProcThreadAttributeList(attributes);
                    if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes); if (handles != IntPtr.Zero) Marshal.FreeHGlobal(handles);
                    if (jobValue != IntPtr.Zero) Marshal.FreeHGlobal(jobValue); if (environment != IntPtr.Zero) Marshal.FreeHGlobal(environment);
                    GC.KeepAlive(job); GC.KeepAlive(output); GC.KeepAlive(input);
                }
            }
        }
    }

    internal sealed class LauncherServer : IDisposable
    {
        private readonly ServerSpec spec;
        private Process process;
        private ProcessJob job;
        private readonly object gate = new object();
        private bool disposed;
        public bool OwnsServer { get { lock (gate) return process != null && !disposed; } }
        public bool OwnedServerExited { get { lock (gate) return process != null && !disposed && process.HasExited; } }
        public LauncherServer(ServerSpec spec) { this.spec = spec; }

        internal static string Quote(string value)
        {
            if (value.Length > 0 && value.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) return value;
            var result = new StringBuilder("\""); int slashes = 0;
            foreach (char c in value)
            {
                if (c == '\\') { slashes++; continue; }
                result.Append('\\', c == '"' ? slashes * 2 + 1 : slashes); result.Append(c); slashes = 0;
            }
            result.Append('\\', slashes * 2); return result.Append('"').ToString();
        }

        public async Task EnsureStarted(string logPath)
        {
            ServerState state = await ServerProbe.Check(spec.Url);
            var identifyDeadline = DateTime.UtcNow.AddSeconds(30);
            while (state == ServerState.Starting && DateTime.UtcNow < identifyDeadline) { await Task.Delay(300); state = await ServerProbe.Check(spec.Url); }
            if (state == ServerState.Composer) return;
            if (state == ServerState.Starting) throw new InvalidOperationException("The server on the app port is still responding slowly. Check its terminal or launcher log, then try again. No process was stopped.");
            if (state == ServerState.Other) throw new InvalidOperationException("The app port is occupied by another program. Close that program or the other local server, then open Application Composer again. No process was stopped.");
            lock (gate)
            {
                if (disposed) throw new ObjectDisposedException("Application Composer");
                Directory.CreateDirectory(Path.GetDirectoryName(logPath));
                job = ProcessJob.Create();
                try { process = NativeProcess.Start(spec, job, logPath); }
                catch { job.Dispose(); job = null; throw; }
            }
            var deadline = DateTime.UtcNow.AddSeconds(120);
            while (DateTime.UtcNow < deadline)
            {
                lock (gate)
                {
                    if (disposed) throw new ObjectDisposedException("Application Composer");
                    if (process.HasExited) throw new InvalidOperationException("The local server exited during startup. Open the launcher log for details, fix the issue, and run pnpm desktop:build if needed.");
                }
                if (await ServerProbe.Check(spec.Url) == ServerState.Composer) return;
                await Task.Delay(400);
            }
            throw new InvalidOperationException("The app did not become ready within two minutes. Check the launcher log and run pnpm desktop:build before retrying.");
        }
        public void Dispose()
        {
            Process ownedProcess; ProcessJob ownedJob;
            lock (gate)
            {
                if (disposed) return; disposed = true;
                ownedProcess = process; ownedJob = job;
                process = null; job = null;
            }
            if (ownedJob != null) ownedJob.Dispose();
            if (ownedProcess != null) { try { ownedProcess.WaitForExit(3000); } catch { } ownedProcess.Dispose(); }
        }
    }
}

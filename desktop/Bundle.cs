using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;

namespace ApplicationComposerDesktop
{
    internal static class AppBundle
    {
        public static string Home
        {
            get
            {
                string custom = Environment.GetEnvironmentVariable("COMPOSER_DESKTOP_HOME");
                if (!String.IsNullOrEmpty(custom))
                {
                    if (!Path.IsPathRooted(custom)) throw new InvalidOperationException("COMPOSER_DESKTOP_HOME must be an absolute folder path.");
                    return Path.GetFullPath(custom);
                }
                return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ApplicationComposer");
            }
        }
        public static string Data { get { return Path.Combine(Home, "data"); } }
        public static string Install()
        {
            string root = Path.Combine(Home, "versions", BuildConfig.BundleId);
            string ready = Path.Combine(root, ".ready");
            if (File.Exists(ready) && File.Exists(Path.Combine(root, "runtime", "node.exe")) && File.Exists(Path.Combine(root, "app", "server.js"))) return root;
            Directory.CreateDirectory(root);
            using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Composer.AppBundle"))
            {
                if (resource == null) throw new InvalidOperationException("The packaged app is missing. Rebuild with pnpm desktop:install.");
                Extract(resource, root);
            }
            File.WriteAllText(ready, BuildConfig.BundleId);
            return root;
        }
        internal static void Extract(Stream stream, string root)
        {
            string boundary = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    string target = Path.GetFullPath(Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
                    if (!target.StartsWith(boundary, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("The app package contains an invalid path.");
                    string ioTarget = @"\\?\" + target;
                    if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(ioTarget); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(ioTarget));
                    using (var input = entry.Open()) using (var output = File.Create(ioTarget)) input.CopyTo(output);
                }
            }
        }
        public static void MigrateProfile()
        {
            Directory.CreateDirectory(Data);
            if (File.Exists(Path.Combine(Data, ".migration-complete"))) return;
            foreach (string name in new[] { "profile.json", "settings.json", "pairing.json", "history.json", "work-projects.json" })
            {
                string source = Path.Combine(BuildConfig.SourceRoot, ".local", name), target = Path.Combine(Data, name);
                if (File.Exists(source) && !File.Exists(target)) File.Copy(source, target);
            }
            File.WriteAllText(Path.Combine(Data, ".migration-complete"), "1");
        }
        public static void RegisterAssemblies()
        {
            AppDomain.CurrentDomain.AssemblyResolve += (sender, args) =>
            {
                string name = new AssemblyName(args.Name).Name;
                if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
                using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
                {
                    if (resource == null) return null;
                    using (var bytes = new MemoryStream()) { resource.CopyTo(bytes); return Assembly.Load(bytes.ToArray()); }
                }
            };
        }
        public static ServerSpec Server(string root)
        {
            var spec = new ServerSpec { Root = Path.Combine(root, "app"), Node = Path.Combine(root, "runtime", "node.exe"), Url = "http://127.0.0.1:32187", Arguments = new[] { Path.Combine(root, "app", "server.js") } };
            spec.Environment["COMPOSER_DATA_DIR"] = Data;
            spec.Environment["HOSTNAME"] = "127.0.0.1"; spec.Environment["PORT"] = "32187";
            return spec;
        }
    }
}

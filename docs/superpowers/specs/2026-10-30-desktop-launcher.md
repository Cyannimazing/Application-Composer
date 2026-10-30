# Standalone desktop app

User clarified that the EXE must open its own window and close-to-shutdown, not remain in a tray/browser launcher.

Deliver one Windows x64 EXE with AC icon, embedded Next standalone app, Node and WebView2 SDK. Windows .NET4.8 and Evergreen WebView2 are OS prerequisites; supported CLI/login stays external. Extract versioned resources to LocalAppData/ApplicationComposer, keep persistent data separate, and migrate only allowlisted app data once. Never package profile, pairing, history, CLI credentials or private build output into Git or the EXE.

Own localhost127.0.0.1:32187; reject external servers, prevent duplicate app instances and close the Windows job with the window. Atomically attach job ownership before process execution. Share a build/runtime mutex and isolate desktop build output from development. Support Windows long paths and complete pnpm manifest-only dependency aliases. Validate staged startup before archiving.

Preserve companion capture, popup copy and reviewed fill. Native WebView2 forwards validated commands to a temporary localhost tab in the real browser profile; close only that unchanged bridge tab, never the job tab. Ship extension files for setup. Test actual extracted startup, WebView rendering, close-to-shutdown, migration, archive safety, native cleanup and secret exclusion. Push source/icon, keep generated EXE local.

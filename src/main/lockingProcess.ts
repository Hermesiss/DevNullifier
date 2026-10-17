import { spawn, type ChildProcess } from "child_process";

const LOCK_TIMEOUT_MS = 8000;

const LOCK_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$name = $null
$session = [uint32]0
$started = $false
try {
  $target = $env:DEVNULLIFIER_LOCK_PATH
  if (-not [string]::IsNullOrWhiteSpace($target)) {
    if (-not ('DevNullifierRestartManager' -as [type])) {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class DevNullifierRestartManager {
  [StructLayout(LayoutKind.Sequential)]
  public struct RM_UNIQUE_PROCESS {
    public int dwProcessId;
    public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
  }

  public enum RM_APP_TYPE {
    RmUnknownApp = 0,
    RmMainWindow = 1,
    RmOtherWindow = 2,
    RmService = 3,
    RmExplorer = 4,
    RmConsole = 5,
    RmCritical = 1000
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
    public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
    public string strServiceShortName;
    public RM_APP_TYPE ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)]
    public bool bRestartable;
  }

  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  public static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

  [DllImport("rstrtmgr.dll")]
  public static extern int RmEndSession(uint pSessionHandle);

  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  public static extern int RmRegisterResources(
    uint pSessionHandle,
    uint nFiles,
    string[] rgsFilenames,
    uint nApplications,
    IntPtr rgApplications,
    uint nServices,
    IntPtr rgsServiceNames);

  [DllImport("rstrtmgr.dll")]
  public static extern int RmGetList(
    uint dwSessionHandle,
    out uint pnProcInfoNeeded,
    ref uint pnProcInfo,
    [In, Out] RM_PROCESS_INFO[] rgAffectedApps,
    ref uint lpdwRebootReasons);
}
'@
    }

    $key = [guid]::NewGuid().ToString('N')
    $start = [DevNullifierRestartManager]::RmStartSession([ref]$session, 0, $key)
    if ($start -eq 0) {
      $started = $true
      $files = [string[]]@($target)
      $registered = [DevNullifierRestartManager]::RmRegisterResources($session, 1, $files, 0, [IntPtr]::Zero, 0, [IntPtr]::Zero)
      if ($registered -eq 0) {
        $needed = [uint32]0
        $count = [uint32]16
        $reasons = [uint32]0
        $infos = New-Object 'DevNullifierRestartManager+RM_PROCESS_INFO[]' 16
        $listed = [DevNullifierRestartManager]::RmGetList($session, [ref]$needed, [ref]$count, $infos, [ref]$reasons)
        if ($listed -eq 234 -and $needed -ge 1) {
          $infos = New-Object 'DevNullifierRestartManager+RM_PROCESS_INFO[]' ([int]$needed)
          $count = [uint32]$needed
          $listed = [DevNullifierRestartManager]::RmGetList($session, [ref]$needed, [ref]$count, $infos, [ref]$reasons)
        }
        if ($listed -eq 0 -and $count -ge 1) {
          $info = $infos[0]
          $proc = Get-Process -Id $info.Process.dwProcessId -ErrorAction SilentlyContinue
          if ($null -ne $proc -and -not [string]::IsNullOrWhiteSpace($proc.ProcessName)) {
            $name = [string]$proc.ProcessName
          } elseif (-not [string]::IsNullOrWhiteSpace($info.strAppName)) {
            $name = [string]$info.strAppName
          }
        }
      }
    }
  }
} catch {
} finally {
  if ($started) {
    try { [void][DevNullifierRestartManager]::RmEndSession($session) } catch {}
  }
}
if (-not [string]::IsNullOrWhiteSpace($name)) { Write-Output $name }
`;

export function lockingProcessArgs(): readonly string[] {
  // EncodedCommand is the fixed script as UTF-16LE base64. The target path stays in
  // DEVNULLIFIER_LOCK_PATH so command-line quoting cannot splice it into the script.
  return [
    "-NoProfile",
    "-NonInteractive",
    "-EncodedCommand",
    Buffer.from(LOCK_SCRIPT, "utf16le").toString("base64")
  ];
}

export function parseLockingProcessOutput(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function decodeStdout(buffer: Buffer): string {
  const text =
    buffer.length >= 2 && buffer[1] === 0
      ? buffer.toString("utf16le")
      : buffer.toString("utf8");
  return text.replace(/^\uFEFF/, "");
}

function killChild(child: ChildProcess): void {
  try {
    child.kill();
  } catch {
    // The process may already have exited.
  }
}

export function queryLockingProcess(target: string): Promise<string | null> {
  if (process.platform !== "win32") return Promise.resolve(null);

  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const chunks: Buffer[] = [];

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    let child: ChildProcess;
    try {
      child = spawn("powershell.exe", [...lockingProcessArgs()], {
        shell: false,
        windowsHide: true,
        env: { ...process.env, DEVNULLIFIER_LOCK_PATH: target }
      });
    } catch {
      resolve(null);
      return;
    }

    timer = setTimeout(() => {
      killChild(child);
      finish(null);
    }, LOCK_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    child.stderr?.on("data", () => {
      // Drain stderr so a full pipe cannot stall the child.
    });
    child.on("error", () => finish(null));
    child.on("close", () => {
      finish(parseLockingProcessOutput(decodeStdout(Buffer.concat(chunks))));
    });
  });
}

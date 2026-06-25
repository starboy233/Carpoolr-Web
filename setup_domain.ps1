# PowerShell Script to map ridetogether.com to localhost in hosts file
# MUST BE RUN AS ADMINISTRATOR

$HostsPath = "C:\Windows\System32\drivers\etc\hosts"
$Domain = "ridetogether.com"
$Entry = "127.0.0.1 $Domain"

# Check if script is run as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: This script must be run as an Administrator to modify the hosts file." -ForegroundColor Yellow
    Write-Host "Please close this window, right-click on the script file, and choose 'Run as Administrator'." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

# Check if entry already exists
$content = Get-Content $HostsPath
$exists = $content | Where-Object { $_ -match "^\s*127\.0\.0\.1\s+$Domain" }

if ($exists) {
    Write-Host "The mapping for '$Domain' already exists in $HostsPath." -ForegroundColor Green
} else {
    Write-Host "Adding mapping for '$Domain' to $HostsPath..." -ForegroundColor Cyan
    # Append the entry with a newline
    Add-Content -Path $HostsPath -Value "`n$Entry"
    Write-Host "Mapping successfully added!" -ForegroundColor Green
}

Write-Host "You can now run 'npm run dev -- --host' in the project directory and visit http://ridetogether.com:5173" -ForegroundColor Cyan
Read-Host "Press Enter to exit"

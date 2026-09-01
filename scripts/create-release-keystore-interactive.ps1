# Creates production keystore and local keystore.properties via interactive prompts.
# Passwords are never written to stdout or committed to git.

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkHome = Join-Path $projectRoot '.tools\jdk-21'
$keytool = Join-Path $jdkHome 'bin\keytool.exe'
$keystorePath = Join-Path $projectRoot 'credentials\garden-diary-release.keystore'
$propsPath = Join-Path $projectRoot 'credentials\keystore.properties'

if (-not (Test-Path $keytool)) {
	Write-Error "JDK 21 not found at $jdkHome"
}

if (Test-Path $keystorePath) {
	Write-Error "Keystore already exists: $keystorePath"
}

New-Item -ItemType Directory -Force -Path (Split-Path $keystorePath) | Out-Null

Write-Host ''
Write-Host '=== Garden Diary production keystore ===' -ForegroundColor Cyan
Write-Host 'Enter the SAME password for store and key (will be used for release signing).'
Write-Host 'Password will NOT be displayed or logged.'
Write-Host ''

$secure = Read-Host 'Keystore password' -AsSecureString
$confirm = Read-Host 'Confirm password' -AsSecureString

function Convert-SecureStringPlain([Security.SecureString]$Value) {
	$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
	try {
		return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
	}
	finally {
		[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
	}
}

$plain = Convert-SecureStringPlain $secure
$plainConfirm = Convert-SecureStringPlain $confirm

if ($plain -ne $plainConfirm) {
	throw 'Passwords do not match.'
}

if ([string]::IsNullOrWhiteSpace($plain)) {
	throw 'Password cannot be empty.'
}

$dname = 'CN=alex1c, OU=Моя дача, O=alex1c, L=Saint Petersburg, ST=Saint Petersburg, C=RU'

try {
	& $keytool -genkeypair -v `
		-keystore $keystorePath `
		-alias garden-diary `
		-keyalg RSA `
		-keysize 2048 `
		-validity 10000 `
		-storepass $plain `
		-keypass $plain `
		-dname $dname

	if ($LASTEXITCODE -ne 0) {
		throw "keytool failed with exit code $LASTEXITCODE"
	}

	$props = @(
		'storeFile=../credentials/garden-diary-release.keystore',
		"storePassword=$plain",
		'keyAlias=garden-diary',
		"keyPassword=$plain"
	) -join "`n"

	Set-Content -Path $propsPath -Value $props -Encoding UTF8 -NoNewline

	Write-Host ''
	Write-Host 'Keystore created successfully.' -ForegroundColor Green
	Write-Host "  $keystorePath"
	Write-Host "  $propsPath"
	Write-Host ''
	Write-Host 'BACK UP the keystore file and store the password securely before RuStore upload.' -ForegroundColor Yellow
}
finally {
	$plain = $null
	$plainConfirm = $null
	$secure = $null
	$confirm = $null
}

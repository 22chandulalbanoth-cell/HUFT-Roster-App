$ErrorActionPreference = 'Stop'
$secureKey = Read-Host 'Enter the Supabase Secret key (input is hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $env:SUPABASE_URL = 'https://sumoyszqxxuarwzpzsgw.supabase.co'
    $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    npm run import
    if ($LASTEXITCODE -ne 0) {
        throw "Import failed with exit code $LASTEXITCODE. You can safely rerun it after correcting the issue."
    }
}
finally {
    Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secureKey.Dispose()
}

param(
    [string]$Output = "..\..\public\wasm"
)

if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
    throw "Emscripten emcc not found. Install Emscripten, activate it, then run this script again."
}

$outputDir = [System.IO.Path]::GetFullPath($Output, $PSScriptRoot)
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

emcc "$PSScriptRoot\src\crsf.c" "$PSScriptRoot\src\crsf_wasm.c" `
    -I "$PSScriptRoot\src" `
    -O3 `
    --no-entry `
    -s EXPORTED_FUNCTIONS="['_malloc','_free','_crsf_wasm_parse','_crsf_wasm_type','_crsf_wasm_frame_length','_crsf_wasm_decode']" `
    -s EXPORTED_RUNTIME_METHODS="['HEAPU8','HEAPU32','HEAPF32']" `
    -s MODULARIZE=1 `
    -s EXPORT_ES6=1 `
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 `
    -Wno-error=unused-function `
    -o "$outputDir\crsf.js"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

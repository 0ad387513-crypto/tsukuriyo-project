$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
$root = Split-Path -Parent $PSScriptRoot
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root $path.TrimStart("/")
    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".js"   { "application/javascript; charset=utf-8" }
            ".json" { "application/json; charset=utf-8" }
            ".css"  { "text/css; charset=utf-8" }
            ".png"  { "image/png" }
            ".jpg"  { "image/jpeg" }
            ".mp3"  { "audio/mpeg" }
            ".wav"  { "audio/wav" }
            default { "application/octet-stream" }
        }
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.OutputStream.Close()
}

# generate_frames.ps1
# =============================================
# 新カードフレーム画像/ の PNG を base64 に変換して frames.js を生成します。
#
# 【実行方法】
#   フレーム画像更新.bat をダブルクリック
#
# 【新しい画像を追加したいとき】
#   1. 新カードフレーム画像/ に PNG を追加（アイコンは アイコン/ サブフォルダ）
#   2. フレーム画像更新.bat をダブルクリック
#
# 【ファイル名とキー名の対応】
#   新カードフレーム画像/*.png  → キー名 = ファイル名（.png を除く）
#     例: 赤_土台.png → "赤_土台"
#   新カードフレーム画像/アイコン/*.png → キー名 = "アイコン_" + ファイル名（.png 除く）
#     例: アイコン/赤_忍者.png → "アイコン_赤_忍者"
#   カミ画像も同様: カミ_アマテラス.png → "カミ_アマテラス"
# =============================================

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$pngDir     = Join-Path $scriptDir "新カードフレーム画像"
$iconDir    = Join-Path $pngDir "アイコン"
$outputFile = Join-Path $scriptDir "frames.js"

Write-Host ""
Write-Host "フレーム画像を変換しています..."
Write-Host ""

$lines       = [System.Collections.Generic.List[string]]::new()
$writtenKeys = [System.Collections.Generic.HashSet[string]]::new()
$count       = 0

$lines.Add("// カードフレーム画像データ（base64形式）")
$lines.Add("// =============================================")
$lines.Add("// このファイルは フレーム画像更新.bat で再生成できます")
$lines.Add("// 新しい画像を追加する場合:")
$lines.Add("//   フレーム: 新カードフレーム画像/ に PNG を追加")
$lines.Add("//   アイコン: 新カードフレーム画像/アイコン/ に PNG を追加")
$lines.Add("// =============================================")
$lines.Add("")
$lines.Add("var FRAME_IMAGES = {")

# ------------------------------------------------
# フレーム画像（ルートフォルダ）
# ファイル名から .png を除いたものがキー名
# ------------------------------------------------
Write-Host "[フレーム画像]"
$pngFiles = Get-ChildItem -Path $pngDir -Filter "*.png" | Sort-Object Name
foreach ($file in $pngFiles) {
    $key     = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $bytes   = [System.IO.File]::ReadAllBytes($file.FullName)
    $base64  = [Convert]::ToBase64String($bytes)
    $dataUri = "data:image/png;base64,$base64"

    if ($writtenKeys.Contains($key)) {
        # 同じキーが既にある場合は上書き
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i].StartsWith("  `"$key`"")) {
                $lines[$i] = "  `"$key`": `"$dataUri`","
                break
            }
        }
    } else {
        $lines.Add("  `"$key`": `"$dataUri`",")
        $writtenKeys.Add($key) | Out-Null
        $count++
    }
    Write-Host "  OK  $($file.Name)  ->  $key"
}

# ------------------------------------------------
# アイコン画像（アイコン/ サブフォルダ）
# キー名 = "アイコン_" + ファイル名（.png 除く）
# ------------------------------------------------
if (Test-Path $iconDir) {
    Write-Host ""
    Write-Host "[アイコン]"
    $iconFiles = Get-ChildItem -Path $iconDir -Filter "*.png" | Sort-Object Name
    foreach ($file in $iconFiles) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $key      = "アイコン_$baseName"
        $bytes    = [System.IO.File]::ReadAllBytes($file.FullName)
        $base64   = [Convert]::ToBase64String($bytes)
        $dataUri  = "data:image/png;base64,$base64"

        if ($writtenKeys.Contains($key)) {
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i].StartsWith("  `"$key`"")) {
                    $lines[$i] = "  `"$key`": `"$dataUri`","
                    break
                }
            }
        } else {
            $lines.Add("  `"$key`": `"$dataUri`",")
            $writtenKeys.Add($key) | Out-Null
            $count++
        }
        Write-Host "  OK  アイコン/$($file.Name)  ->  $key"
    }
} else {
    Write-Host ""
    Write-Host "  (アイコン/ フォルダが見つかりません)"
}

$lines.Add("};")

# UTF-8（BOMなし）で書き出し
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($outputFile, $lines, $utf8NoBom)

$sizeMB = [Math]::Round((Get-Item $outputFile).Length / 1MB, 1)
Write-Host ""
Write-Host "完了: frames.js を生成しました（$sizeMB MB、$count 件）"

# index.html の frames.js 読み込みにタイムスタンプを付与（ブラウザキャッシュ対策）
$htmlPath = Join-Path $scriptDir "index.html"
if (Test-Path $htmlPath) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)
    $html = $html -replace 'frames\.js(\?v=[0-9]+)?', "frames.js?v=$ts"
    [System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))
    Write-Host "index.html キャッシュバスト更新: ?v=$ts"
}

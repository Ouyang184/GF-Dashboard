param(
  [Parameter(Mandatory = $true)]
  [string]$RecordsBase64,
  [Parameter(Mandatory = $true)]
  [string]$PrinterBase64
)

$ErrorActionPreference = "Stop"
$recordsJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($RecordsBase64))
$records = @($recordsJson | ConvertFrom-Json)
$printer = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PrinterBase64))
$printed = 0
$failed = 0
$excel = $null
$workbook = $null

try {
  $installedPrinter = Get-Printer -Name $printer -ErrorAction Stop
  if (-not $installedPrinter) { throw "Printer '$printer' is not installed." }

  foreach ($record in $records) {
    $filePath = [string]$record.filePath
    $resolvedPath = [IO.Path]::GetFullPath($filePath)
    if (-not $resolvedPath.StartsWith("I:\Department Files\Molding\", [StringComparison]::OrdinalIgnoreCase)) {
      throw "Printing is restricted to approved Molding Mastercard folders."
    }
    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
      $failed += 1
      continue
    }

    try {
      $extension = [IO.Path]::GetExtension($resolvedPath).ToLowerInvariant()
      if ($extension -in @(".xlsx", ".xlsm", ".xls")) {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $workbook = $excel.Workbooks.Open($resolvedPath, 0, $true)

        foreach ($sheet in $workbook.Worksheets) {
          if ($sheet.Visible -ne -1) { continue }
          $sheet.PageSetup.PrintArea = $sheet.UsedRange.Address()
          $sheet.PageSetup.Zoom = $false
          $sheet.PageSetup.FitToPagesWide = 1
          $sheet.PageSetup.FitToPagesTall = $false
          $sheet.PageSetup.CenterHorizontally = $true
          # ActivePrinter targets this one call at $printer directly, unlike
          # changing the machine-wide default printer (the previous
          # approach): that mutated global state for the whole system, and a
          # hard-killed script (e.g. the Node-side execFile timeout) could
          # leave every other app's print jobs silently misdirected there
          # until someone noticed and manually fixed the default printer.
          $sheet.PrintOut([Type]::Missing, [Type]::Missing, [Type]::Missing, [Type]::Missing, $printer)
        }

        $workbook.Close($false)
        [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
        $workbook = $null
        $excel.Quit()
        [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        $excel = $null
      } else {
        Start-Process -FilePath $resolvedPath -Verb PrintTo -ArgumentList "`"$printer`"" -WindowStyle Hidden
      }
      $printed += 1
    } catch {
      $failed += 1
    }
  }

  [pscustomobject]@{
    success = ($printed -gt 0 -and $failed -eq 0)
    message = if ($printed -gt 0) {
      "Submitted $printed file(s) to $printer. This confirms command submission, not physical printing."
    } else {
      "No files were submitted to $printer."
    }
    printed = $printed
    failed = $failed
  } | ConvertTo-Json -Compress
} catch {
  [pscustomobject]@{
    success = $false
    message = $_.Exception.Message
    printed = $printed
    failed = $failed
  } | ConvertTo-Json -Compress
} finally {
  if ($workbook) {
    $workbook.Close($false)
    [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
  }
  if ($excel) {
    $excel.Quit()
    [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

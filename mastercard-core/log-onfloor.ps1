param(
  [Parameter(Mandatory = $true)]
  [string]$RecordsBase64
)

$ErrorActionPreference = "Stop"
$workbookName = "MasterCard_OnFloor.xlsx"
$recordsJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($RecordsBase64))
$records = @($recordsJson | ConvertFrom-Json)
$excel = $null
$workbook = $null
$createdNewExcel = $false
$added = 0
$skipped = 0

try {
  $possiblePaths = @(
    (Join-Path $env:USERPROFILE "Georg Fischer\GFPS-AMG Manufacturing Engineering - Documentation\Yan's Intern list\$workbookName")
  )
  if ($env:OneDriveCommercial) {
    $possiblePaths += Join-Path $env:OneDriveCommercial "GFPS-AMG Manufacturing Engineering - Documentation\Yan's Intern list\$workbookName"
    $possiblePaths += Join-Path $env:OneDriveCommercial "Documentation\Yan's Intern list\$workbookName"
  }
  $candidatePaths = @($possiblePaths | Where-Object { Test-Path -LiteralPath $_ })

  if ($candidatePaths.Count -eq 0) {
    $companySyncRoot = Join-Path $env:USERPROFILE "Georg Fischer"
    if (Test-Path -LiteralPath $companySyncRoot) {
      $candidatePaths = @(
        Get-ChildItem -LiteralPath $companySyncRoot -Filter $workbookName -File -Recurse -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty FullName
      )
    }
  }

  $workbookPath = $candidatePaths | Select-Object -First 1
  if (-not $workbookPath) {
    throw "MasterCard_OnFloor.xlsx was not found. Sync the GFPS-AMG Manufacturing Engineering Documentation library from Teams, then try again."
  }

  try {
    $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
  } catch {
    # No Excel session was already running -- this instance is ours alone,
    # so it must stay hidden and must be the one thing we clean up below. If
    # we instead attached to the user's own already-open Excel, we must
    # never hide or quit it out from under them.
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $createdNewExcel = $true
  }

  foreach ($candidate in $excel.Workbooks) {
    if ($candidate.Name -ieq $workbookName) {
      $workbook = $candidate
      break
    }
  }

  if (-not $workbook) {
    Start-Process -FilePath $workbookPath
    $deadline = (Get-Date).AddSeconds(45)
    while (-not $workbook -and (Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 500
      foreach ($candidate in $excel.Workbooks) {
        if ($candidate.Name -ieq $workbookName) {
          $workbook = $candidate
          break
        }
      }
    }
  }

  if (-not $workbook) { throw "Excel did not open $workbookName." }
  if ($workbook.ReadOnly) { throw "$workbookName is read-only or locked by another user." }

  $table = $workbook.Worksheets.Item("Table1").ListObjects.Item("Table2")
  $existing = @{}
  foreach ($row in $table.ListRows) {
    $part = [string]$row.Range.Cells.Item(1, 1).Text
    $machine = [string]$row.Range.Cells.Item(1, 2).Text
    $mold = [string]$row.Range.Cells.Item(1, 3).Text
    $key = "$($part.Trim().ToUpperInvariant())|$($machine.Trim().ToUpperInvariant())|$($mold.Trim().ToUpperInvariant())"
    $existing[$key] = $true
  }

  foreach ($record in $records) {
    $part = [string]$record.partNumber
    $machine = if ([string]$record.machineNumber -match "^MA") { [string]$record.machineNumber } else { "MA$($record.machineNumber)" }
    $mold = if ([string]$record.moldBaseNumber -match "^MB") { [string]$record.moldBaseNumber } else { "MB$($record.moldBaseNumber)" }
    $key = "$($part.Trim().ToUpperInvariant())|$($machine.Trim().ToUpperInvariant())|$($mold.Trim().ToUpperInvariant())"

    if ($existing.ContainsKey($key)) {
      $skipped += 1
      continue
    }

    $newRow = $table.ListRows.Add()
    $newRow.Range.Cells.Item(1, 1).Value2 = $part
    $newRow.Range.Cells.Item(1, 2).Value2 = $machine
    $newRow.Range.Cells.Item(1, 3).Value2 = $mold
    $newRow.Range.Cells.Item(1, 4).Value2 = [string]$record.material
    $newRow.Range.Cells.Item(1, 5).Value2 = "Onfloor"
    $dateCell = $newRow.Range.Cells.Item(1, 6)
    $dateCell.Value2 = [double](Get-Date).ToOADate()
    $dateCell.NumberFormat = "m/d/yyyy"
    $existing[$key] = $true
    $added += 1
  }

  $workbook.Save()
  [pscustomobject]@{
    success = $true
    message = "Logged $added row(s) to MasterCard_OnFloor.xlsx; skipped $skipped duplicate(s)."
    added = $added
    skipped = $skipped
  } | ConvertTo-Json -Compress
} catch {
  [pscustomobject]@{
    success = $false
    message = $_.Exception.Message
    added = $added
    skipped = $skipped
  } | ConvertTo-Json -Compress
} finally {
  if ($workbook) { [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
  # Only quit the Excel instance we created ourselves. If we attached to an
  # Excel the user already had open (GetActiveObject succeeded), quitting it
  # here would close all of their other open workbooks too.
  if ($excel -and $createdNewExcel) {
    $excel.Quit()
  }
  if ($excel) { [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

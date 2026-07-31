param(
  [Parameter(Mandatory = $true)]
  [string]$FilePathBase64
)

$ErrorActionPreference = "Stop"
$excel = $null
$workbook = $null

function Get-ExcelColumnName([int]$columnNumber) {
  $name = ""
  while ($columnNumber -gt 0) {
    $columnNumber--
    $name = [char](65 + ($columnNumber % 26)) + $name
    $columnNumber = [Math]::Floor($columnNumber / 26)
  }
  return $name
}

try {
  $filePath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($FilePathBase64))
  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    throw "The Mastercard file no longer exists."
  }

  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false
  $workbook = $excel.Workbooks.Open($filePath, 0, $true)
  $cells = [Collections.Generic.List[object]]::new()

  foreach ($worksheet in $workbook.Worksheets) {
    $used = $worksheet.UsedRange
    $rows = [Math]::Min([int]$used.Rows.Count, 300)
    $columns = [Math]::Min([int]$used.Columns.Count, 80)
    $firstRow = [int]$used.Row
    $firstColumn = [int]$used.Column
    $values = $used.Value2

    for ($rowOffset = 0; $rowOffset -lt $rows; $rowOffset++) {
      for ($columnOffset = 0; $columnOffset -lt $columns; $columnOffset++) {
        if ($rows -eq 1 -and $columns -eq 1) {
          $value = $values
        } else {
          $value = $values.GetValue($rowOffset + 1, $columnOffset + 1)
        }
        $text = [Convert]::ToString($value, [Globalization.CultureInfo]::InvariantCulture)
        if (-not [string]::IsNullOrWhiteSpace($text)) {
          $cells.Add([pscustomobject]@{
            sheet = [string]$worksheet.Name
            cell = "$(Get-ExcelColumnName ($firstColumn + $columnOffset))$($firstRow + $rowOffset)"
            value = $text.Trim()
          })
          if ($cells.Count -ge 6000) { break }
        }
      }
      if ($cells.Count -ge 6000) { break }
    }
    [Runtime.InteropServices.Marshal]::ReleaseComObject($used) | Out-Null
    if ($cells.Count -ge 6000) { break }
  }

  [pscustomobject]@{
    success = $true
    filePath = $filePath
    cells = $cells
  } | ConvertTo-Json -Depth 5 -Compress
}
catch {
  [pscustomobject]@{
    success = $false
    message = $_.Exception.Message
  } | ConvertTo-Json -Compress
  exit 1
}
finally {
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

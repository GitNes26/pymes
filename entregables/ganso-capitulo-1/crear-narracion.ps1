$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$voice = New-Object -ComObject SAPI.SpVoice
$spanish = @($voice.GetVoices()) | Where-Object { $_.GetDescription() -like '*Sabina*' } | Select-Object -First 1
if ($spanish) { $voice.Voice = $spanish }
$voice.Rate = 0
$voice.Volume = 100
$stream = New-Object -ComObject SAPI.SpFileStream
$stream.Format.Type = 22
$stream.Open((Join-Path $here 'narracion.wav'), 3, $false)
$voice.AudioOutputStream = $stream
[void]$voice.Speak((Get-Content -Raw -Encoding UTF8 (Join-Path $here 'narracion.txt')))
$stream.Close()
Write-Output 'Narración creada'

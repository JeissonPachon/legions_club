Param(
    [Parameter(Mandatory=$true)]
    [string]$TargetHost,
    [int]$Port = 5432,
    [string]$Out = "certs\ca.pem"
)

try {
    $dir = Split-Path $Out -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($TargetHost, $Port)
    $stream = $tcp.GetStream()

    $ssl = New-Object System.Net.Security.SslStream($stream, $false, ({$true}))
    $ssl.AuthenticateAsClient($TargetHost)

    $remoteCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $ssl.RemoteCertificate
    $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
    $chain.Build($remoteCert) | Out-Null

    $pem = ""
    foreach ($elem in $chain.ChainElements) {
        $raw = $elem.Certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        $b64 = [System.Convert]::ToBase64String($raw)
        $chunks = ($b64 -split '(.{64})' | Where-Object { $_ -ne '' })
        $pem += "-----BEGIN CERTIFICATE-----`n"
        $pem += ($chunks -join "`n") + "`n"
        $pem += "-----END CERTIFICATE-----`n"
    }

    Set-Content -Path $Out -Value $pem -NoNewline -Encoding Ascii
    Write-Output "Wrote $Out"
}
catch {
    Write-Error "Failed to extract certificate chain: $_"
}
finally {
    try { if ($ssl) { $ssl.Close() } } catch {}
    try { if ($tcp -and $tcp.Connected) { $tcp.Close() } } catch {}
}

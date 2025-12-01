# 🧪 Script de test des routes email

Write-Host "🚀 Test des routes email du backend GBA" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5000"

# Vérifier si le serveur est lancé
Write-Host "📡 Vérification du serveur..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✅ Serveur actif: $($health.status)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Serveur non accessible. Lancez 'npm run dev' d'abord !" -ForegroundColor Red
    exit 1
}

# Tester l'inscription (avec email automatique)
Write-Host "📝 Test 1: Inscription avec email automatique" -ForegroundColor Yellow
try {
    $registerBody = @{
        name = "Test User"
        email = "test-$(Get-Random)@example.com"
        password = "test123456"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody

    Write-Host "✅ Inscription réussie" -ForegroundColor Green
    Write-Host "   User ID: $($response._id)" -ForegroundColor Gray
    Write-Host "   Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    $token = $response.token
} catch {
    Write-Host "❌ Échec: $($_.Exception.Message)" -ForegroundColor Red
    $token = $null
}
Write-Host ""

# Si on a un token, tester notify-admin
if ($token) {
    Write-Host "📧 Test 2: Notification admin" -ForegroundColor Yellow
    try {
        $notifyBody = @{
            customerName = "John Doe"
            customerEmail = "john@example.com"
            vehicleMake = "Toyota"
            vehicleModel = "Corolla"
            vehicleYear = "2023"
            pickupDate = "2025-12-10"
            returnDate = "2025-12-20"
            totalPrice = 500
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/api/orders/notify-admin" `
            -Method Post `
            -ContentType "application/json" `
            -Headers @{ Authorization = "Bearer $token" } `
            -Body $notifyBody

        Write-Host "✅ Notification admin envoyée" -ForegroundColor Green
        Write-Host "   Accepted: $($response.result.accepted -join ', ')" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Échec: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Tests terminés !" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 Routes disponibles:" -ForegroundColor Yellow
Write-Host "   - POST /api/auth/register (email bienvenue automatique)" -ForegroundColor Gray
Write-Host "   - POST /api/auth/send-welcome-email (admin)" -ForegroundColor Gray
Write-Host "   - POST /api/orders/notify-admin" -ForegroundColor Gray
Write-Host "   - POST /api/orders/:id/send-notification (admin)" -ForegroundColor Gray
Write-Host "   - POST /api/orders/:id/send-payment-reminder (admin)" -ForegroundColor Gray
Write-Host "   - POST /api/orders/:id/send-rental-summary (admin)" -ForegroundColor Gray
Write-Host ""
Write-Host "⚙️  Pour tester sur Render:" -ForegroundColor Yellow
Write-Host "   Changez `$baseUrl à https://votre-backend.onrender.com" -ForegroundColor Gray

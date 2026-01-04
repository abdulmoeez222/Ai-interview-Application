# PowerShell script to setup PostgreSQL database

Write-Host "Setting up InterWiz Database..." -ForegroundColor Green

# Check if Docker is running
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start PostgreSQL container
Write-Host "`nStarting PostgreSQL container..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start PostgreSQL container." -ForegroundColor Red
    exit 1
}

# Wait for PostgreSQL to be ready
Write-Host "`nWaiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if container is running
$containerStatus = docker ps --filter "name=interwiz-postgres" --format "{{.Status}}"
if ($containerStatus -match "Up") {
    Write-Host "✓ PostgreSQL container is running" -ForegroundColor Green
} else {
    Write-Host "ERROR: PostgreSQL container is not running." -ForegroundColor Red
    Write-Host "Check logs with: docker logs interwiz-postgres" -ForegroundColor Yellow
    exit 1
}

# Test database connection
Write-Host "`nTesting database connection..." -ForegroundColor Yellow
$testConnection = docker exec interwiz-postgres psql -U postgres -d interwiz_mvp -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database connection successful!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Database connection failed." -ForegroundColor Red
    Write-Host "Check logs with: docker logs interwiz-postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Database Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nDatabase Details:" -ForegroundColor Cyan
Write-Host "  Host: localhost" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: interwiz_mvp" -ForegroundColor White
Write-Host "  Username: postgres" -ForegroundColor White
Write-Host "  Password: postgres123" -ForegroundColor White
Write-Host "`nConnection String:" -ForegroundColor Cyan
Write-Host "  postgresql://postgres:postgres123@localhost:5432/interwiz_mvp?schema=public" -ForegroundColor White
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Go to interwiz-backend directory" -ForegroundColor White
Write-Host "  2. Create .env file with DATABASE_URL" -ForegroundColor White
Write-Host "  3. Run: npm run prisma:generate" -ForegroundColor White
Write-Host "  4. Run: npm run prisma:migrate" -ForegroundColor White
Write-Host "`n" -ForegroundColor White


# سكربت لرفع المشروع مباشرة إلى GitHub
$RepoUrl = "https://github.com/Farouk-eladawy/Meusem-Tiqets.git"

Write-Host "🚀 بدء تجهيز الملفات والرفع إلى GitHub..." -ForegroundColor Cyan

# التحقق من وجود مستودع Git، وإذا لم يوجد نقوم بإنشائه
if (-not (Test-Path ".git")) {
    Write-Host "📦 تهيئة مستودع Git جديد..." -ForegroundColor Yellow
    git init
}

# إضافة جميع الملفات
Write-Host "➕ إضافة الملفات..." -ForegroundColor Yellow
git add .

# إنشاء Commit
$CommitMessage = "Initial commit: Project structure, Netlify setup, and UI template"
Write-Host "📝 إنشاء Commit: $CommitMessage" -ForegroundColor Yellow
git commit -m $CommitMessage

# إعادة تسمية الفرع الرئيسي إلى main (المعيار الجديد في GitHub)
git branch -M main

# التحقق من وجود Remote باسم origin
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "🔄 تحديث رابط origin الحالي..." -ForegroundColor Yellow
    git remote set-url origin $RepoUrl
} else {
    Write-Host "🔗 ربط المستودع بالرابط: $RepoUrl" -ForegroundColor Yellow
    git remote add origin $RepoUrl
}

# الرفع إلى GitHub
Write-Host "⬆️ جاري الرفع إلى GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ تم الرفع بنجاح! يمكنك الآن ربط المستودع بـ Netlify." -ForegroundColor Green
} else {
    Write-Host "❌ حدث خطأ أثناء الرفع. يرجى التحقق من الأخطاء أعلاه (قد تحتاج إلى تسجيل الدخول في GitHub)." -ForegroundColor Red
}

#!/usr/bin/env bash
# Сборка CraftMine PE для iOS (нужен macOS с Xcode и XcodeGen: brew install xcodegen).
# Результат: dist/CraftMine-PE-<версия>.ipa — неподписанный. Установить на iPhone можно через
# Sideloadly или AltStore (они подписывают его твоим Apple ID), либо подписать своим сертификатом.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
VERSION=$(grep -o 'android:versionName="[^"]*"' $ROOT/android/AndroidManifest.xml | cut -d'"' -f2)

echo "[1/4] Текстуры и игра -> CraftMine/www"
(cd $ROOT && python3 tools/pack-textures.py && python3 tools/pack-sounds.py)
rm -rf CraftMine/www && mkdir -p CraftMine/www
cp $ROOT/index.html CraftMine/www/
cp -r $ROOT/css $ROOT/js $ROOT/fonts CraftMine/www/

echo "[2/4] Проект Xcode (XcodeGen)"
xcodegen generate --spec project.yml

echo "[3/4] Сборка (без подписи)"
rm -rf build
xcodebuild -project CraftMinePE.xcodeproj -scheme CraftMinePE -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build | tail -n 30

echo "[4/4] Упаковка .ipa"
APP=$(find build/Build/Products/Release-iphoneos -maxdepth 1 -name '*.app' | head -n 1)
rm -rf Payload && mkdir Payload && cp -R "$APP" Payload/
mkdir -p $ROOT/dist
OUT=$ROOT/dist/CraftMine-PE-$VERSION.ipa
rm -f "$OUT" && zip -qry "$OUT" Payload && rm -rf Payload
echo "Готово: $OUT"

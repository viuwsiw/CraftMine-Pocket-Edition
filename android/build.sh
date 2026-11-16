#!/usr/bin/env bash
# Сборка APK без Gradle и полного Android SDK.
# Нужны (Ubuntu/Debian): sudo apt install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23 default-jdk
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
ANDROID_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
VERSION=$(grep -o 'android:versionName="[^"]*"' AndroidManifest.xml | cut -d'"' -f2)
OUT=$ROOT/dist/CraftMine-PE-$VERSION.apk
B=build
rm -rf $B && mkdir -p $B/classes $B/assets $ROOT/dist

echo "[1/6] Копирую игру в assets"
cp $ROOT/index.html $B/assets/
cp -r $ROOT/css $ROOT/js $ROOT/fonts $B/assets/

echo "[2/6] Ресурсы и манифест (aapt)"
aapt package -f -M AndroidManifest.xml -S res -A $B/assets -I "$ANDROID_JAR" -F $B/unsigned.apk

echo "[3/6] Компиляция Java"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d $B/classes $(find src -name '*.java')

echo "[4/6] DEX"
dalvik-exchange --dex --min-sdk-version=21 --output=$B/classes.dex $B/classes
(cd $B && aapt add unsigned.apk classes.dex >/dev/null)

echo "[5/6] Выравнивание (zipalign)"
zipalign -f -p 4 $B/unsigned.apk $B/aligned.apk

echo "[6/6] Подпись (apksigner)"
KS=${KEYSTORE:-debug.keystore}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias craftmine \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=CraftMine PE Debug" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias craftmine \
  --min-sdk-version 21 --out "$OUT" $B/aligned.apk
apksigner verify "$OUT"
echo "Готово: $OUT ($(du -h "$OUT" | cut -f1))"

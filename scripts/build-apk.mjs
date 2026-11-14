// scripts/build-apk.mjs
// Builds android/app/build/outputs/apk/debug/app-debug.apk.
// Gradle needs Java 17+; if JAVA_HOME isn't set, use Android Studio's bundled JDK.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const env = { ...process.env };

const hasJava = (home) =>
  !!home &&
  (fs.existsSync(path.join(home, "bin", "java.exe")) ||
    fs.existsSync(path.join(home, "bin", "java")));

if (!hasJava(env.JAVA_HOME)) {
  if (env.JAVA_HOME) console.log(`Ignoring invalid JAVA_HOME: ${env.JAVA_HOME}`);
  delete env.JAVA_HOME;
  const candidates = [
    "C:/Program Files/Android/Android Studio/jbr",
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    "/opt/android-studio/jbr",
  ];
  const jbr = candidates.find((p) => fs.existsSync(p));
  if (jbr) {
    env.JAVA_HOME = jbr;
    console.log(`Using Android Studio JDK: ${jbr}`);
  }
}

const isWin = process.platform === "win32";
const androidDir = path.resolve("android");
const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");
const task = process.argv[2] || "assembleDebug";

const result = spawnSync(isWin ? `"${gradlew}"` : gradlew, [task], {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: isWin,
});

process.exit(result.status ?? 1);

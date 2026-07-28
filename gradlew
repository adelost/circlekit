#!/bin/sh
# Minimal gradlew shim — uses the wrapper jar in gradle/wrapper/.
# Auto-discovers JDK 17 and Android SDK in ~/android-dev if env vars are unset,
# so `./gradlew ...` Just Works from any terminal once the toolchain is bootstrapped.

DIR=$(cd "$(dirname "$0")" && pwd)

if [ -z "$JAVA_HOME" ] && [ -d "$HOME/android-dev/jdk17" ]; then
    export JAVA_HOME="$HOME/android-dev/jdk17"
fi
if [ -z "$ANDROID_HOME" ] && [ -d "$HOME/android-dev/sdk" ]; then
    export ANDROID_HOME="$HOME/android-dev/sdk"
fi

if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "JAVA_HOME is not set and no JDK 17 found at ~/android-dev/jdk17" >&2
    echo "See INSTALL.md to bootstrap the toolchain." >&2
    exit 1
fi

exec "$JAVA_HOME/bin/java" \
    -classpath "$DIR/gradle/wrapper/gradle-wrapper.jar" \
    org.gradle.wrapper.GradleWrapperMain "$@"

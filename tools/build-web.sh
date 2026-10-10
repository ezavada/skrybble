#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIR=${SKRYBBLE_WEB_OUTPUT:-"$PROJECT_DIR/dist"}
PDG_CACHE_DIR=${PDG_CACHE_DIR:-"$PROJECT_DIR/.pdg"}
REFRESH_PDG=0

if [ "${1:-}" = "--refresh-pdg" ]; then
    REFRESH_PDG=1
    shift
fi

if [ "$#" -ne 0 ]; then
    echo "Usage: $0 [--refresh-pdg]" >&2
    exit 2
fi

LOCAL_WASM_DIR="$PROJECT_DIR/../pdg-devel/build/wasm/wasm32/release"
if [ -z "${PDG_WASM_DIR:-}" ] && [ "$REFRESH_PDG" -eq 0 ] &&
   [ -f "$LOCAL_WASM_DIR/libpdg.js" ] && [ -f "$LOCAL_WASM_DIR/libpdg.wasm" ]; then
    PDG_WASM_DIR="$LOCAL_WASM_DIR"
fi

if [ -z "${PDG_WASM_DIR:-}" ]; then
    # shellcheck disable=SC1091
    . "$PROJECT_DIR/tools/pdg-release.env"

    PDG_WASM_DIR="$PDG_CACHE_DIR/$PDG_VERSION/emscripten-wasm32"
    PDG_HASH_FILE="$PDG_WASM_DIR/.asset-sha256"
    CACHED_HASH=""
    if [ -f "$PDG_HASH_FILE" ]; then
        CACHED_HASH=$(sed -n '1p' "$PDG_HASH_FILE")
    fi

    if [ "$REFRESH_PDG" -eq 1 ] ||
       [ ! -f "$PDG_WASM_DIR/libpdg.js" ] ||
       [ ! -f "$PDG_WASM_DIR/libpdg.wasm" ] ||
       [ "$CACHED_HASH" != "$PDG_EMSCRIPTEN_WASM32_SHA256" ]; then
        command -v curl >/dev/null 2>&1 || {
            echo "curl is required to download PDG" >&2
            exit 1
        }
        command -v unzip >/dev/null 2>&1 || {
            echo "unzip is required to unpack PDG" >&2
            exit 1
        }

        TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/skrybble-pdg.XXXXXX")
        trap 'rm -rf "$TEMP_DIR"' EXIT HUP INT TERM
        PDG_ARCHIVE="$TEMP_DIR/$PDG_EMSCRIPTEN_WASM32_ASSET"
        PDG_DOWNLOAD_URL="$PDG_REPOSITORY/releases/download/$PDG_TAG/$PDG_EMSCRIPTEN_WASM32_ASSET"

        echo "Downloading PDG $PDG_TAG Emscripten/Wasm32 runtime..."
        curl --fail --location --silent --show-error \
            --output "$PDG_ARCHIVE" "$PDG_DOWNLOAD_URL"

        if command -v shasum >/dev/null 2>&1; then
            ACTUAL_HASH=$(shasum -a 256 "$PDG_ARCHIVE" | awk '{print $1}')
        elif command -v sha256sum >/dev/null 2>&1; then
            ACTUAL_HASH=$(sha256sum "$PDG_ARCHIVE" | awk '{print $1}')
        else
            echo "shasum or sha256sum is required to verify PDG" >&2
            exit 1
        fi

        if [ "$ACTUAL_HASH" != "$PDG_EMSCRIPTEN_WASM32_SHA256" ]; then
            echo "PDG archive SHA-256 mismatch" >&2
            echo "Expected: $PDG_EMSCRIPTEN_WASM32_SHA256" >&2
            echo "Actual:   $ACTUAL_HASH" >&2
            exit 1
        fi

        unzip -q "$PDG_ARCHIVE" -d "$TEMP_DIR/unpacked"
        EXTRACTED_DIR="$TEMP_DIR/unpacked/${PDG_EMSCRIPTEN_WASM32_ASSET%.zip}"
        if [ ! -f "$EXTRACTED_DIR/libpdg.js" ] ||
           [ ! -f "$EXTRACTED_DIR/libpdg.wasm" ] ||
           [ ! -f "$EXTRACTED_DIR/VERSION" ] ||
           [ "$(sed -n '1p' "$EXTRACTED_DIR/VERSION")" != "$PDG_VERSION" ]; then
            echo "PDG archive does not contain the expected $PDG_VERSION web runtime" >&2
            exit 1
        fi

        mkdir -p "$PDG_WASM_DIR"
        cp -R "$EXTRACTED_DIR/." "$PDG_WASM_DIR/"
        printf '%s\n' "$PDG_EMSCRIPTEN_WASM32_SHA256" > "$PDG_HASH_FILE"
    fi
fi

if [ ! -f "$PDG_WASM_DIR/libpdg.js" ] || [ ! -f "$PDG_WASM_DIR/libpdg.wasm" ]; then
    echo "PDG WebAssembly artifacts were not found in $PDG_WASM_DIR" >&2
    echo "Set PDG_WASM_DIR to a directory containing libpdg.js and libpdg.wasm" >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR/vendor/pdg-mvc-app"
cp "$PROJECT_DIR/web/index.html" "$PROJECT_DIR/web/skrybble-web.js" "$OUTPUT_DIR/"
cp "$PDG_WASM_DIR/libpdg.js" "$PDG_WASM_DIR/libpdg.wasm" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/LICENSE" "$PROJECT_DIR/ASSET_RIGHTS.md" "$OUTPUT_DIR/"
if [ -f "$PDG_WASM_DIR/LICENSE" ]; then
    cp "$PDG_WASM_DIR/LICENSE" "$OUTPUT_DIR/PDG-LICENSE"
else
    cp "$PROJECT_DIR/vendor/PDG-LICENSE" "$OUTPUT_DIR/PDG-LICENSE"
fi
if [ -d "$PDG_WASM_DIR/THIRD_PARTY_LICENSES" ]; then
    mkdir -p "$OUTPUT_DIR/PDG-THIRD-PARTY-LICENSES"
    cp -R "$PDG_WASM_DIR/THIRD_PARTY_LICENSES/." "$OUTPUT_DIR/PDG-THIRD-PARTY-LICENSES/"
fi
cp "$PROJECT_DIR"/*.js "$OUTPUT_DIR/"
cp "$PROJECT_DIR/vendor/pdg-defs.js" "$OUTPUT_DIR/vendor/"
cp "$PROJECT_DIR/vendor/pdg-mvc-app"/*.js "$OUTPUT_DIR/vendor/pdg-mvc-app/"

echo "Built Skrybble web app in $OUTPUT_DIR"
echo "Serve it over HTTP, for example: python3 -m http.server --directory '$OUTPUT_DIR' 8080"

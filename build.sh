#!/usr/bin/env bash
set -euo pipefail

TMP_BUILD_DIR=""

download_esbuild() {
  curl -fsSL https://esbuild.github.io/dl/latest | sh
}

usage() {
  echo "usage: build.sh [version] [-h, --help] [-b, --esbuild]"
}

help() {
  usage
  echo "If you do not specify a version, the version specified in manifest.json will be used"
  echo
  echo "-h, --help    shows this help screen"
  echo "-b, --esbuild the path to the esbuild binary to use, if none is specified, we assume it's in the local directory or on the path"
}

resolve_esbuild() {
  local provided="${1:-}"
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

  # 1) Provided path
  if [[ -n "$provided" ]]; then
    if [[ -x "$provided" ]]; then
      printf '%s\n' "$provided"
      return 0
    fi
    echo "Invalid esbuild binary: $provided" >&2
    return 1
  fi

  # 2) Local to project (next to this script)
  if [[ -x "$script_dir/esbuild" ]]; then
    printf '%s\n' "$script_dir/esbuild"
    return 0
  fi

  # 3) On PATH
  local found=""
  found="$(command -v esbuild || true)"
  if [[ -n "$found" && -x "$found" ]]; then
    printf '%s\n' "$found"
    return 0
  fi

  return 2
}

prompt_install_esbuild() {
  # If the script is run without an interactive terminal, don't hang.
  if [[ ! -t 0 ]]; then
    echo "esbuild was not found, and no interactive TTY is available to prompt." >&2
    echo "Install esbuild or pass -b/--esbuild. See: https://esbuild.github.io/getting-started/#install-esbuild" >&2
    return 1
  fi

  echo "esbuild was not found." >&2
  echo "Install instructions: https://esbuild.github.io/getting-started/#install-esbuild" >&2
  printf 'Download esbuild automatically now? [y/N] ' >&2

  local ans=""

  # Read from the real terminal to avoid cases where stdin is redirected.
  read -r ans </dev/tty
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}


parse_args() {
  SHOW_HELP=false
  VERSION=""
  ESBUILD_PATH=""

  while (($#)); do
    case "$1" in
      -h|--help)
        SHOW_HELP=true
        shift
        ;;
      -b|--esbuild)
        [[ $# -ge 2 ]] || { echo "$1 requires a path" >&2; return 1; }
        ESBUILD_PATH="$2"
        shift 2
        ;;
      --esbuild=*)
        ESBUILD_PATH="${1#*=}"
        shift
        ;;
      -*)
        echo "Unknown flag: $1" >&2
        return 1
        ;;
      *)
        [[ -z "$VERSION" ]] || { echo "Only one version allowed" >&2; return 1; }
        VERSION="$1"
        shift
        ;;
    esac
  done
}

require_tools() {
  command -v jq  >/dev/null 2>&1 || { echo "Missing required tool: jq"  >&2; return 1; }
  command -v zip >/dev/null 2>&1 || { echo "Missing required tool: zip" >&2; return 1; }
}

get_esbuild() {
  local provided="${1:-}"
  local resolved=""
  local status=0

  # resolve_esbuild may return non-zero; with `set -e` we must not exit here.
  set +e
  resolved="$(resolve_esbuild "$provided")"
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    printf '%s\n' "$resolved"
    return 0
  fi

  # status 2 means "not found"
  if [[ $status -ne 2 ]]; then
    return 1
  fi

  if ! prompt_install_esbuild; then
    echo "Aborting (esbuild required)." >&2
    return 1
  fi

  download_esbuild

  set +e
  resolved="$(resolve_esbuild "")"
  status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    echo "esbuild still not found after download. See: https://esbuild.github.io/getting-started/#install-esbuild" >&2
    return 1
  fi

  printf '%s\n' "$resolved"
}

rewrite_popup_html() {
  local in="$1"
  local out="$2"

  # Requires markers:
  # <!-- BUILD:POPUP_SCRIPTS -->
  # ...
  # <!-- /BUILD:POPUP_SCRIPTS -->

  # 1) Delete everything between markers (excluding markers)
  # 2) Insert prod script after start marker
  sed -e '/<!-- BUILD:POPUP_SCRIPTS -->/,/<!-- \/BUILD:POPUP_SCRIPTS -->/{
    /<!-- BUILD:POPUP_SCRIPTS -->/b
    /<!-- \/BUILD:POPUP_SCRIPTS -->/b
    d
  }' "$in" \
  | sed '/<!-- BUILD:POPUP_SCRIPTS -->/a\
    <script src="popup.js"></script>' \
  > "$out"
}

make_entry_from_jq_array() {
  local out="$1"
  local jq_filter="$2"
  local prefix="${3:-./}"

  : > "$out"
  jq -r "$jq_filter" manifest.json | while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    printf 'import "%s%s";\n' "$prefix" "$f" >> "$out"
  done
}

make_content_entry() {
  local out="$1"
  make_entry_from_jq_array "$out" '.content_scripts[0].js[]' "../"
}

make_popup_entry_from_html_block() {
  local out="$1"
  : > "$out"

  sed -n '/<!-- BUILD:POPUP_SCRIPTS -->/,/<!-- \/BUILD:POPUP_SCRIPTS -->/p' src/popup/popup.html \
    | sed -n 's/.*<script[^>]*src="\([^"]\+\)".*/\1/p' \
    | while IFS= read -r rel; do
        [[ -n "$rel" ]] || continue

        if [[ "$rel" == ../* ]]; then
          rel="${rel#../}"               # shared/x.js
          printf 'import "../src/%s";\n' "$rel" >> "$out"
          continue
        fi

        printf 'import "../src/popup/%s";\n' "$rel" >> "$out"
      done
}

copy_manifest_css() {
  jq -r '.content_scripts[].css[]?' manifest.json | while IFS= read -r css; do
    [[ -n "$css" ]] || continue
    [[ -f "$css" ]] || { echo "Missing CSS referenced in manifest: $css" >&2; return 1; }

    local dst="dist/${css#src/}"
    mkdir -p "$(dirname "$dst")"
    cp "$css" "$dst"
  done
}

copy_icons() {
  mkdir -p dist/icons/png
  cp src/icons/png/*.png dist/icons/png/
}

copy_and_minify_resources() {
  shopt -s nullglob

  mkdir -p dist/resources/
  cp src/resources/*.json dist/resources/

  local resource tmp

  for resource in dist/resources/*.json; do
    tmp=$(mktemp)
    jq -c . "$resource" > "$tmp"
    mv "$tmp" "$resource"
  done
}

write_dist_manifest() {
  # - content scripts js -> ["content.js"]
  # - css and icon paths: src/... -> ... (because we copy into dist without src/)
  # - popup path -> "popup/popup.html"
  jq '
    .content_scripts |= map(.js = ["content.js"] | if .css then .css |= map(sub("^src/"; "")) else . end)
    | .icons |= map_values(sub("^src/"; ""))
    | .browser_action.default_icon |= map_values(sub("^src/"; ""))
    | .browser_action.default_popup = "popup/popup.html"
  ' manifest.json > dist/manifest.json
}

make_tmpdir() {
  local root="$1"
  mktemp -d -p "$root" ".build-tmp.XXXXXX"
}

build_dist() {
  local esbuild="$1"

  rm -rf dist
  mkdir -p dist/popup

  # popup html rewrite (prod: single popup.js)
  rewrite_popup_html "src/popup/popup.html" "dist/popup/popup.html"

  # Copy popup css
  cp "src/popup/styles.css" "dist/popup/styles.css"

  # copy css from manifest automatically
  copy_manifest_css

  # copy static resources
  copy_and_minify_resources

  # copy icons
  copy_icons

  # copy LICENSE
  cp LICENSE dist/LICENSE 2>/dev/null || true

  # Determine project root (directory of this script)
  local project_root=""
  project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

  # entrypoints derived from manifest / popup.html
  TMP_BUILD_DIR="$(make_tmpdir "$project_root")"
  trap 'rm -rf "${TMP_BUILD_DIR:-}"' EXIT

  make_content_entry "$TMP_BUILD_DIR/content.entry.js"
  make_popup_entry_from_html_block "$TMP_BUILD_DIR/popup.entry.js"

  # bundle/minify
  "$esbuild" "$TMP_BUILD_DIR/content.entry.js" \
    --bundle --minify \
    --target=firefox140 --format=iife \
    --define:RESOURCES_BASE='"resources/"' \
    --outfile="dist/content.js"

  "$esbuild" "$TMP_BUILD_DIR/popup.entry.js" \
    --bundle --minify \
    --target=firefox140 --format=iife \
    --define:RESOURCES_BASE='"resources/"' \
    --outfile="dist/popup/popup.js"

  # dist manifest
  write_dist_manifest
}

build_xpi() {
  local version="$1"
  mkdir -p "build/$version"
  (cd dist && zip -qr "../build/$version/ycbc@queertry.com.xpi" .)
  echo "Successfully built version $version"
}

main() {
  parse_args "$@" || return 1

  if $SHOW_HELP; then
    help
    return 0
  fi

  require_tools || return 1

  if [[ -z "$VERSION" ]]; then
    VERSION="v$(jq -r '.version' manifest.json)"
  fi

  local esbuild=""
  esbuild="$(get_esbuild "$ESBUILD_PATH")" || return 1

  build_dist "$esbuild"
  build_xpi "$VERSION"
}

main "$@"
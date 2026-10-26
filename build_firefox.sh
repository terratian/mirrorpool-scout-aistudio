#!/usr/bin/env bash
# Builds the Firefox package from the Chrome files. Firefox MV3 uses background.scripts (event page), not a service worker.
set -e
cd "$(dirname "$0")"
bash build_release.sh >/dev/null
VERSION=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
rm -rf dist-firefox && mkdir dist-firefox && (cd dist && cp -r . ../dist-firefox/) 
python3 - <<'PY'
import json
p="dist-firefox/manifest.json"; m=json.load(open(p))
m["background"]={"scripts":["affiliate.js","scryfall.js","background.js"]}
m["browser_specific_settings"]={"gecko":{"id":"scout@mirrorpool.app","strict_min_version":"128.0","data_collection_permissions":{"required":["none"]}}}
json.dump(m,open(p,"w"),indent=2)
PY
rm -f dist-firefox/INSTALL.txt
cat > dist-firefox/INSTALL-FIREFOX.txt <<'T'
Mirror Pool Scout for Firefox (temporary install, until the add-on is listed on addons.mozilla.org)
1. Unzip this folder.
2. In Firefox open about:debugging#/runtime/this-firefox
3. Click "Load Temporary Add-on" and pick manifest.json inside the folder.
4. Open the add-on's permissions (about:addons > Mirror Pool Scout > Permissions) and allow access to all sites listed.
Temporary add-ons are removed when Firefox restarts; the listed version will not have that limit.
T
OUT="mirrorpool-scout-firefox-v${VERSION}.zip"; rm -f "$OUT"
(cd dist-firefox && zip -qr "../$OUT" .)
echo "built $OUT"

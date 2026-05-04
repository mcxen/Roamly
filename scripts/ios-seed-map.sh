#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ID="${BUNDLE_ID:-com.openspring.roamly.mobile}"
DEVICE_NAME="${DEVICE_NAME:-iPhone 17 Pro}"

if [[ "$#" -gt 0 ]]; then
  IMAGE_PATHS=("$@")
else
  IMAGE_PATHS=(
    "/Users/mcx/Downloads/地图收集/1951年中国交通地图.jpg"
    "/Users/mcx/Downloads/地图收集/龙江省近代地图.jpg"
    "/Users/mcx/Downloads/地图收集/杂图/IMG_5640.JPG"
    "/Users/mcx/Downloads/地图收集/杂图/IMG_5659.JPG"
    "/Users/mcx/Downloads/地图收集/杂图/IMG_5655.JPG"
  )
fi

sim_udid() {
  xcrun simctl list devices available "$DEVICE_NAME" | awk -F '[()]' '/Shutdown|Booted/ { print $2; exit }'
}

UDID="$(sim_udid)"
if [[ -z "$UDID" ]]; then
  echo "No available simulator named '$DEVICE_NAME'." >&2
  exit 1
fi

if ! xcrun simctl list devices | grep "$UDID" | grep -q "Booted"; then
  xcrun simctl boot "$UDID" || true
fi
xcrun simctl bootstatus "$UDID" -b >/dev/null

DATA_DIR="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
LIBRARY_DIR="$DATA_DIR/Documents/RoamlyLibrary"
ORIGINALS_DIR="$LIBRARY_DIR/files/originals"
THUMBNAILS_DIR="$LIBRARY_DIR/files/thumbnails"
MANIFEST="$LIBRARY_DIR/manifest.json"
mkdir -p "$ORIGINALS_DIR" "$THUMBNAILS_DIR"

python3 - "$MANIFEST" "$ORIGINALS_DIR" "$THUMBNAILS_DIR" "${IMAGE_PATHS[@]}" <<'PY'
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

manifest_path = Path(sys.argv[1])
originals_dir = Path(sys.argv[2])
thumbnails_dir = Path(sys.argv[3])
image_paths = [Path(p) for p in sys.argv[4:]]
now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def slug(value):
    value = re.sub(r"\W+", "-", value.lower()).strip("-")
    return value or "map"

def metadata(path):
    name = path.name
    stem = path.stem
    if "1951年中国交通地图" in name:
        return {
            "id": "seed-1951-china-traffic-map",
            "title": "1951年中国交通地图",
            "description": "1951 年全国交通图扫描件，覆盖中国铁路、公路、航线与主要城市交通网络。",
            "tags": ["交通", "公路", "铁路", "历史地图", "共和国初期"],
            "collection_unit": "人民交通出版社",
            "scope_level": "national",
            "country_code": "CN",
            "country_name": "中国",
            "province": "",
            "related_countries": ["中国"],
            "related_provinces": [],
            "city": "",
            "district": "",
            "latitude": 32.5,
            "longitude": 107.5,
            "north_latitude": 53.6,
            "south_latitude": 18.2,
            "east_longitude": 135.0,
            "west_longitude": 73.6,
            "year_label": "1951",
            "campaign": "全国交通图",
            "teaching_use": "历史交通网络研究",
            "ocr_status": "complete",
            "ocr_excerpt": "全国交通图，一九五一年，铁路、公路、航线。"
        }
    if "龙江" in name:
        return {
            "id": "seed-modern-longjiang-province",
            "title": "龙江省近代地图",
            "description": "近代龙江省区域图，包含边界、主要城镇、交通线路和插图。",
            "tags": ["龙江", "黑龙江", "近代", "行政区", "交通"],
            "collection_unit": "东北地方图",
            "scope_level": "province",
            "country_code": "CN",
            "country_name": "中国",
            "province": "黑龙江",
            "related_countries": ["中国"],
            "related_provinces": ["黑龙江", "吉林", "内蒙古"],
            "city": "",
            "district": "",
            "latitude": 47.6,
            "longitude": 126.6,
            "north_latitude": 50.2,
            "south_latitude": 45.6,
            "east_longitude": 130.0,
            "west_longitude": 121.8,
            "year_label": "近代",
            "campaign": "龙江省图",
            "teaching_use": "东北边界与交通研究",
            "ocr_status": "pending",
            "ocr_excerpt": "龙江省全图，边界、城镇、铁路、公路。"
        }
    if "5640" in name:
        return {
            "id": "seed-heilongjiang-1949-1961",
            "title": "黑龙江省行政区划沿革图",
            "description": "黑龙江省 1949 至 1961 年行政区划沿革说明，含多期边界和文字注释。",
            "tags": ["黑龙江", "行政区划", "沿革", "1949-1961"],
            "collection_unit": "行政区划沿革图",
            "scope_level": "province",
            "country_code": "CN",
            "country_name": "中国",
            "province": "黑龙江",
            "related_countries": ["中国"],
            "related_provinces": ["黑龙江", "吉林", "内蒙古"],
            "city": "哈尔滨",
            "district": "",
            "latitude": 47.8,
            "longitude": 127.0,
            "north_latitude": 53.6,
            "south_latitude": 43.4,
            "east_longitude": 135.1,
            "west_longitude": 121.2,
            "year_label": "1949-1961",
            "campaign": "行政区划沿革",
            "teaching_use": "历史行政边界对比",
            "ocr_status": "partial",
            "ocr_excerpt": "黑龙江省，1949-1953，1954-1961，行政区划沿革说明。"
        }
    if "5659" in name:
        return {
            "id": "seed-philippines-map",
            "title": "菲律宾示意图",
            "description": "菲律宾群岛与周边海域示意图，含省界、海岸线与区域标注。",
            "tags": ["菲律宾", "群岛", "外国地图", "海域", "边界"],
            "collection_unit": "外交部专用地图",
            "scope_level": "country",
            "country_code": "PH",
            "country_name": "菲律宾",
            "province": "",
            "related_countries": ["菲律宾", "中国", "马来西亚"],
            "related_provinces": [],
            "city": "马尼拉",
            "district": "",
            "latitude": 12.9,
            "longitude": 122.8,
            "north_latitude": 21.2,
            "south_latitude": 4.5,
            "east_longitude": 127.2,
            "west_longitude": 116.9,
            "year_label": "示意图",
            "campaign": "菲律宾区域",
            "teaching_use": "外国地图与群岛范围研究",
            "ocr_status": "pending",
            "ocr_excerpt": "菲律宾示意图，吕宋、米沙鄢、棉兰老，南海与太平洋。"
        }
    if "5655" in name:
        return {
            "id": "seed-jiangxi-1949-1956",
            "title": "江西省行政区划沿革图",
            "description": "江西省 1949 至 1956 年行政区划沿革图，含多个阶段区划与说明。",
            "tags": ["江西", "行政区划", "沿革", "历史地图"],
            "collection_unit": "行政区划沿革图",
            "scope_level": "province",
            "country_code": "CN",
            "country_name": "中国",
            "province": "江西",
            "related_countries": ["中国"],
            "related_provinces": ["江西", "湖南", "福建", "浙江", "安徽"],
            "city": "南昌",
            "district": "",
            "latitude": 27.8,
            "longitude": 115.9,
            "north_latitude": 30.1,
            "south_latitude": 24.4,
            "east_longitude": 118.5,
            "west_longitude": 113.5,
            "year_label": "1949-1956",
            "campaign": "行政区划沿革",
            "teaching_use": "省级行政区演变研究",
            "ocr_status": "partial",
            "ocr_excerpt": "江西省，1949-1950，1951-1956，行政区划沿革说明。"
        }
    return {
        "id": f"seed-{slug(stem)}",
        "title": stem,
        "description": "本地测试地图图片。",
        "tags": ["本地导入", "待整理"],
        "collection_unit": "本地导入",
        "scope_level": "unknown",
        "country_code": None,
        "country_name": None,
        "province": None,
        "related_countries": [],
        "related_provinces": [],
        "city": None,
        "district": None,
        "latitude": None,
        "longitude": None,
        "north_latitude": None,
        "south_latitude": None,
        "east_longitude": None,
        "west_longitude": None,
        "year_label": None,
        "campaign": "",
        "teaching_use": "",
        "ocr_status": "pending",
        "ocr_excerpt": ""
    }

try:
    with manifest_path.open("r", encoding="utf-8") as f:
        records = json.load(f)
except FileNotFoundError:
    records = []

new_records = []
for image_path in image_paths:
    if not image_path.exists():
        print(f"skip missing image: {image_path}", file=sys.stderr)
        continue
    meta = metadata(image_path)
    record_id = meta["id"]
    ext = image_path.suffix.lower() or ".jpg"
    original = originals_dir / f"{record_id}{ext}"
    thumbnail = thumbnails_dir / f"{record_id}.jpg"
    shutil.copyfile(image_path, original)
    subprocess.run(["sips", "-Z", "1280", str(image_path), "--out", str(thumbnail)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    size = image_path.stat().st_size
    record = {
        **meta,
        "file_name": image_path.name,
        "security_level": "公开",
        "favorite": record_id in {"seed-1951-china-traffic-map", "seed-philippines-map"},
        "mime": "image/jpeg",
        "width": None,
        "height": None,
        "size_bytes": size,
        "mtime_ms": None,
        "updated_at": now,
        "created_at": now,
        "source": "local-seed",
        "ocr_text": None if meta["ocr_status"] != "complete" else meta["ocr_excerpt"],
        "imported_at": now,
        "files": {"original": "", "thumbnail": ""}
    }
    new_records.append(record)

ids = {record["id"] for record in new_records}
records = [record for record in records if record.get("id") not in ids]
records = new_records + records

with manifest_path.open("w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Seeded {len(new_records)} image(s).")
PY

echo "Seeded ${#IMAGE_PATHS[@]} requested image(s) into $BUNDLE_ID on $DEVICE_NAME ($UDID)"

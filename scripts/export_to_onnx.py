"""
Script untuk export model YOLO SAR dari .pt ke .onnx
Jalankan sekali di terminal: python scripts/export_to_onnx.py

Requirements: pip install ultralytics
"""

from pathlib import Path
from ultralytics import YOLO

# Path ke model yang sudah di-train
MODEL_PATH = Path(__file__).parent.parent / "Yololol" / "runs" / "detect" / "SAR_Drone_Project" / "yolo11n_sar_run" / "weights" / "best.pt"

# Output: taruh di public/models/ biar langsung bisa diakses browser
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print(f"Loading model dari: {MODEL_PATH}")
model = YOLO(str(MODEL_PATH))

print("Exporting ke ONNX...")
exported_path = model.export(
    format="onnx",
    imgsz=640,        # Input image size (sama dengan waktu training)
    opset=12,         # ONNX opset version — kompatibel dengan onnxruntime-web
    simplify=True,    # Simplify graph untuk performa lebih baik
    dynamic=False,    # Static batch size = 1 untuk browser
)

# Pindahkan ke public/models/
import shutil
src = Path(exported_path)
dst = OUTPUT_DIR / "yolo_sar.onnx"
shutil.copy2(src, dst)

print(f"\n✅ Berhasil! Model ONNX tersimpan di: {dst}")
print(f"   Ukuran file: {dst.stat().st_size / 1024 / 1024:.1f} MB")
print("\nLangkah selanjutnya:")
print("  1. Jalankan: npm install")
print("  2. Jalankan: npm run dev")
print("  3. Aktifkan AI Detect di Mission Overview")

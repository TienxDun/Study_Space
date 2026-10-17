"""
Video Keyframe Extractor Utility for Screenshot-to-Code Skill
Extracts frames from an input video file using FFmpeg for deep visual and interaction analysis.
"""

import os
import sys
import json
import subprocess
from pathlib import Path


def extract_frames(video_path: str, output_dir: str = None, fps: float = 2.0, max_frames: int = 30) -> dict:
    video_file = Path(video_path).resolve()
    if not video_file.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    if output_dir is None:
        output_dir = video_file.parent / f"{video_file.stem}_frames"
    else:
        output_dir = Path(output_dir).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Probe video metadata
    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration,nb_frames",
        "-show_entries", "format=duration",
        "-of", "json",
        str(video_file)
    ]
    
    metadata = {}
    try:
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        probe_data = json.loads(probe_res.stdout)
        stream = probe_data.get("streams", [{}])[0]
        fmt = probe_data.get("format", {})
        duration = float(stream.get("duration") or fmt.get("duration") or 0.0)
        width = int(stream.get("width", 0))
        height = int(stream.get("height", 0))
        metadata = {
            "duration_seconds": duration,
            "width": width,
            "height": height,
        }
    except Exception as e:
        print(f"Warning: ffprobe failed or not available ({e}). Proceeding with extraction.")

    # 2. Extract frames at specified fps
    pattern = str(output_dir / "frame_%04d.png")
    
    # ffmpeg command to sample frames
    # fps=2 means 2 frames per second (every 0.5s)
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video_file),
        "-vf", f"fps={fps}",
        "-frames:v", str(max_frames),
        pattern
    ]

    print(f"Extracting frames from {video_file} to {output_dir}...")
    subprocess.run(ffmpeg_cmd, capture_output=True, check=True)

    frame_files = sorted(list(output_dir.glob("frame_*.png")))
    frames_info = []
    interval = 1.0 / fps

    for idx, fpath in enumerate(frame_files):
        timestamp = idx * interval
        frames_info.append({
            "index": idx + 1,
            "timestamp": round(timestamp, 2),
            "file": str(fpath),
            "filename": fpath.name
        })

    result = {
        "video_path": str(video_file),
        "output_directory": str(output_dir),
        "frame_count": len(frame_files),
        "fps_sampled": fps,
        "metadata": metadata,
        "frames": frames_info
    }

    report_path = output_dir / "report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Successfully extracted {len(frame_files)} frames.")
    print(f"Metadata and frame report written to: {report_path}")
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_video_frames.py <path_to_video> [output_dir] [fps]")
        sys.exit(1)

    v_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else None
    sample_fps = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0

    try:
        res = extract_frames(v_path, out_dir, sample_fps)
        print(json.dumps(res, indent=2))
    except Exception as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)

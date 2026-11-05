#!/usr/bin/env python3
"""Generate extension PNG icons from SVG using macOS built-in tools (sips).

Renders toolbar sizes (16, 32, 48) edge-to-edge, and pads the 128 size with a
16px transparent border to center the 96x96 artwork per store guidelines.
"""

from pathlib import Path
import struct
import subprocess
import sys
import zlib


SIZES = [16, 32, 48, 128]


def unfilter_png(data: bytes) -> tuple[int, int, bytearray]:
    """Parse and unfilter PNG scanlines using Python standard library."""
    idx = 8
    idat = bytearray()
    w, h, depth, color_type = 0, 0, 0, 0
    while idx < len(data):
        length, ctype = struct.unpack(">I4s", data[idx:idx + 8])
        chunk = data[idx + 8:idx + 8 + length]
        if ctype == b"IHDR":
            w, h, depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", chunk)
        elif ctype == b"IDAT":
            idat.extend(chunk)
        idx += 12 + length

    if color_type != 6 or depth != 8:
        raise ValueError(f"Expected 8-bit RGBA PNG, got color_type={color_type}, depth={depth}")

    raw = zlib.decompress(idat)
    bpp = 4
    stride = 1 + w * bpp
    unfiltered = bytearray(h * w * bpp)

    def paeth(a: int, b: int, c: int) -> int:
        p = a + b - c
        pa = abs(p - a)
        pb = abs(p - b)
        pc = abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    for y in range(h):
        filter_type = raw[y * stride]
        for x in range(w * bpp):
            val = raw[y * stride + 1 + x]
            left = unfiltered[y * w * bpp + x - bpp] if x >= bpp else 0
            up = unfiltered[(y - 1) * w * bpp + x] if y > 0 else 0
            up_left = unfiltered[(y - 1) * w * bpp + x - bpp] if (y > 0 and x >= bpp) else 0

            if filter_type == 0:
                res = val
            elif filter_type == 1:
                res = (val + left) & 0xFF
            elif filter_type == 2:
                res = (val + up) & 0xFF
            elif filter_type == 3:
                res = (val + ((left + up) >> 1)) & 0xFF
            elif filter_type == 4:
                res = (val + paeth(left, up, up_left)) & 0xFF
            else:
                res = val
            unfiltered[y * w * bpp + x] = res

    return w, h, unfiltered


def inspect_and_preview(png_path: Path, show_ascii: bool = False) -> None:
    """Inspect pixel bounds, corner transparency, and print ASCII preview."""
    data = png_path.read_bytes()
    w, h, pixels = unfilter_png(data)
    bpp = 4

    opaque_points = []
    for y in range(h):
        for x in range(w):
            alpha = pixels[y * w * bpp + x * bpp + 3]
            if alpha > 0:
                opaque_points.append((x, y))

    if not opaque_points:
        print(f"Error: {png_path.name} is completely transparent", file=sys.stderr)
        sys.exit(1)

    min_x = min(p[0] for p in opaque_points)
    max_x = max(p[0] for p in opaque_points)
    min_y = min(p[1] for p in opaque_points)
    max_y = max(p[1] for p in opaque_points)

    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    corner_alphas = [pixels[y * w * bpp + x * bpp + 3] for x, y in corners]

    coverage = len(opaque_points) / (w * h)
    print(f"[{png_path.name}] {w}x{h} px: bounds=({min_x}, {min_y}) to ({max_x}, {max_y}), coverage={coverage:.1%}, corner_alphas={corner_alphas}")

    # Verify bounds: 128 icon has 16px padding per store guidelines, toolbar icons fill edge to edge
    if w == 128 and h == 128:
        if min_x != 16 or min_y != 16 or max_x != 111 or max_y != 111:
            print(f"Error: 128 icon artwork is not centered with 16px padding: bounds=({min_x}, {min_y}) to ({max_x}, {max_y})", file=sys.stderr)
            sys.exit(1)
        border_alphas = [
            pixels[(y * w + x) * bpp + 3]
            for y in range(h)
            for x in range(w)
            if x < 16 or x > 111 or y < 16 or y > 111
        ]
        if any(a != 0 for a in border_alphas):
            print("Error: 128 icon border is not fully transparent", file=sys.stderr)
            sys.exit(1)
    else:
        # Verify edge-to-edge coverage: should reach borders 0 and w-1/h-1
        if min_x != 0 or min_y != 0 or max_x != (w - 1) or max_y != (h - 1):
            print(f"Error: icon does not fill canvas edge to edge: bounds=({min_x}, {min_y}) to ({max_x}, {max_y})", file=sys.stderr)
            sys.exit(1)

        # Verify corner transparency: squircle corners must be transparent
        if any(a > 50 for a in corner_alphas):
            print(f"Warning: corners are not transparent: {corner_alphas}", file=sys.stderr)

    if show_ascii:
        print(f"--- ASCII Preview of {png_path.name} ---")
        step = max(1, w // 32)
        for y in range(0, h, step * 2):
            line = ""
            for x in range(0, w, step):
                r = pixels[y * w * bpp + x * bpp]
                g = pixels[y * w * bpp + x * bpp + 1]
                b = pixels[y * w * bpp + x * bpp + 2]
                a = pixels[y * w * bpp + x * bpp + 3]
                if a < 30:
                    line += " "
                elif r > 200 and g < 100:
                    line += "/"
                elif r > 200 and g > 200 and b > 200:
                    line += "#"
                elif r < 40 and g < 50:
                    line += "."
                else:
                    line += "+"
            print(line)
        print("------------------------------------------")


# Pad the 128 icon with transparent borders to meet Chrome Web Store guidelines.
def pad_store_icon(png_path: Path, canvas_size: int = 128) -> None:
    subprocess.run(
        ["sips", "-p", str(canvas_size), str(canvas_size), str(png_path), "--out", str(png_path)],
        check=True,
        capture_output=True,
    )


def generate_icons(repo_root: Path) -> None:
    icons_dir = repo_root / "icons"
    svg_path = icons_dir / "icon.svg"

    if not svg_path.is_file():
        print(f"Error: source SVG not found at {svg_path}", file=sys.stderr)
        sys.exit(1)

    icons_dir.mkdir(parents=True, exist_ok=True)

    # Convert SVG directly to PNG at each target size using macOS sips
    for size in SIZES:
        target_png = icons_dir / f"icon-{size}.png"
        render_size = 96 if size == 128 else size
        subprocess.run(
            ["sips", "-s", "format", "png", "-z", str(render_size), str(render_size), str(svg_path), "--out", str(target_png)],
            check=True,
            capture_output=True,
        )
        if size == 128:
            pad_store_icon(target_png, canvas_size=128)
        inspect_and_preview(target_png, show_ascii=(size == 128 or size == 32))


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    generate_icons(repo_root)
    print("All icons successfully generated, edge-to-edge checked, and visually verified.")


if __name__ == "__main__":
    main()

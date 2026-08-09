#!/usr/bin/env python3
"""Package promoted carousel slides into verified LinkedIn PDF documents."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


DEFAULT_LIBRARIES = ("015", "017", "028")


def slide_paths(carousel_dir: Path) -> list[Path]:
    slides = sorted(carousel_dir.glob("slide-*.webp"), key=lambda path: int(path.stem.split("-")[-1]))
    expected = [carousel_dir / f"slide-{index}.webp" for index in range(1, 7)]
    if slides != expected:
        raise ValueError(f"{carousel_dir.name}: expected exactly slide-1.webp through slide-6.webp")
    return slides


def build_document(carousel_dir: Path) -> tuple[Path, Path]:
    slides = slide_paths(carousel_dir)
    dimensions: list[tuple[int, int]] = []
    for slide in slides:
        with Image.open(slide) as image:
            dimensions.append(image.size)
            if image.mode != "RGB":
                raise ValueError(f"{slide}: expected RGB artwork, found {image.mode}")
    if len(set(dimensions)) != 1:
        raise ValueError(f"{carousel_dir.name}: slide dimensions do not match: {dimensions}")

    width, height = dimensions[0]
    pdf_path = carousel_dir / f"222-emails-carousel-{carousel_dir.name}.pdf"
    thumbnail_path = carousel_dir / "thumbnail.jpg"

    document = canvas.Canvas(str(pdf_path), pagesize=(width, height), pageCompression=1, invariant=1)
    document.setTitle(f"222 Emails carousel {carousel_dir.name}")
    document.setAuthor("222 Emails")
    for slide in slides:
        document.drawImage(ImageReader(str(slide)), 0, 0, width=width, height=height, preserveAspectRatio=False)
        document.showPage()
    document.save()

    with Image.open(slides[0]) as cover:
        cover.save(thumbnail_path, "JPEG", quality=92, optimize=True, progressive=True)

    reader = PdfReader(str(pdf_path))
    if len(reader.pages) != 6:
        raise ValueError(f"{pdf_path}: expected 6 pages, found {len(reader.pages)}")
    for index, page in enumerate(reader.pages, start=1):
        page_width = round(float(page.mediabox.width))
        page_height = round(float(page.mediabox.height))
        if (page_width, page_height) != (width, height):
            raise ValueError(
                f"{pdf_path}: page {index} is {page_width}x{page_height}, expected {width}x{height}"
            )
    if pdf_path.stat().st_size > 100 * 1024 * 1024:
        raise ValueError(f"{pdf_path}: exceeds LinkedIn's 100 MB document limit")
    return pdf_path, thumbnail_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "libraries",
        nargs="*",
        default=DEFAULT_LIBRARIES,
        help="Carousel library IDs to package (default: 015 017 028)",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("apps/linkedin-review/media/carousels"),
        help="Directory containing promoted carousel folders",
    )
    args = parser.parse_args()

    for library_id in args.libraries:
        pdf_path, thumbnail_path = build_document(args.root / library_id)
        print(f"{library_id}: {pdf_path} ({pdf_path.stat().st_size} bytes), {thumbnail_path}")


if __name__ == "__main__":
    main()

"""Generate certificate and student ID-card PDFs with reportlab."""

import io
import urllib.request
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from ..config import get_settings

SCHOOL_NAME = "EXAM FOCUS ACADEMY"
TAGLINE = "Focused Preparation. Real Results."
NAVY = colors.HexColor("#1e3a8a")
GOLD = colors.HexColor("#c9a227")
GOLD_LIGHT = colors.HexColor("#f0d98c")
CREAM = colors.HexColor("#fdfaf1")
INK = colors.HexColor("#222222")
SLATE = colors.HexColor("#5b6472")

_FONT_DIR = Path(__file__).resolve().parent / ".." / "assets" / "fonts"

FONT_HAND = "HaileScript"
FONT_IT = "Times-Italic"
FONT_TB = "Times-Bold"
FONT_TBI = "Times-BoldItalic"
FONT_TR = "Times-Roman"

_hand_registered = False


def _register_hand_font() -> str:
    """Register the bundled handwriting font for the Director's signature.

    Falls back to a large italic font if the TrueType file is unavailable.
    """
    global _hand_registered
    if _hand_registered:
        return FONT_HAND
    candidates = [
        _FONT_DIR / "SegoeScript.ttf",
        _FONT_DIR / "SegoeScriptBold.ttf",
    ]
    for path in candidates:
        try:
            if not path.is_file():
                continue
            pdfmetrics.registerFont(TTFont(FONT_HAND, str(path)))
            _hand_registered = True
            return FONT_HAND
        except Exception:
            continue
    return FONT_TBI


def _today() -> str:
    return datetime.now().strftime("%B %d, %Y")


def _wrap(c, text, font, size, width):
    """Split text into lines that fit width at the given font size."""
    lines = []
    for raw in text.split("\n"):
        words = raw.split()
        current = ""
        for word in words:
            trial = f"{current} {word}".strip()
            if c.stringWidth(trial, font, size) <= width or not current:
                current = trial
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def _fetch_image(url: str) -> bytes | None:
    try:
        if url.startswith("http"):
            req = urllib.request.Request(url, headers={"User-Agent": "exam-focus/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read()
        elif url.startswith("/"):
            base = get_settings().PUBLIC_BASE_URL.rstrip("/")
            with urllib.request.urlopen(f"{base}{url}", timeout=8) as resp:
                data = resp.read()
        else:
            return None
        return data if len(data) < 6 * 1024 * 1024 else None
    except Exception:
        return None


def _draw_photo(c, initials, url, cx, cy, r):
    """Draw a circular photo (or an initials monogram) centred at (cx, cy+base)."""
    data = _fetch_image(url) if url else None
    img = None
    if data:
        try:
            from reportlab.lib.utils import ImageReader

            img = ImageReader(io.BytesIO(data))
            img.getSize()
        except Exception:
            img = None
    if img is not None:
        c.saveState()
        p = c.beginPath()
        p.circle(cx, cy + r, r)
        c.clipPath(p, stroke=0)
        c.drawImage(img, cx - r, cy, 2 * r, 2 * r, mask="auto")
        c.restoreState()
        c.setStrokeColor(NAVY)
        c.setLineWidth(2.5)
        c.circle(cx, cy + r, r, stroke=1, fill=0)
        return
    # Monogram fallback.
    c.setStrokeColor(NAVY)
    c.setLineWidth(2.5)
    c.circle(cx, cy + r, r, stroke=1, fill=0)
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, r * 0.7)
    c.drawCentredString(cx, cy + r * 0.55, initials)


def build_certificate_pdf(student_full_name: str, course_title: str, issuer_name: str) -> bytes:
    """A landscape certificate of achievement, signed by the Director."""
    hand = _register_hand_font()
    page_w, page_h = landscape(A4)
    c = canvas.Canvas(io.BytesIO(), pagesize=(page_w, page_h))

    # Background + double border.
    c.setFillColor(CREAM)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    m = 30
    c.setStrokeColor(NAVY)
    c.setLineWidth(4)
    c.roundRect(m, m, page_w - 2 * m, page_h - 2 * m, 16, stroke=1, fill=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    c.roundRect(m + 10, m + 10, page_w - 2 * m - 20, page_h - 2 * m - 20, 10, stroke=1, fill=0)

    cy = page_h - 95
    # Header.
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 15)
    c.drawCentredString(page_w / 2, cy, SCHOOL_NAME)
    c.setFillColor(GOLD)
    c.setFont(FONT_IT, 11.5)
    c.drawCentredString(page_w / 2, cy - 18, TAGLINE)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(page_w / 2 - 180, cy - 28, page_w / 2 + 180, cy - 28)

    # Title.
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 30)
    c.drawCentredString(page_w / 2, cy - 78, "CERTIFICATE OF ACHIEVEMENT")

    c.setFillColor(INK)
    c.setFont(FONT_IT, 14)
    c.drawCentredString(page_w / 2, cy - 122, "This certificate is proudly presented to")

    # Student name.
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 34)
    c.drawCentredString(page_w / 2, cy - 168, student_full_name)

    lines = _wrap(
        c,
        f"for successfully completing the course \"{course_title}\" with distinction at {SCHOOL_NAME.title()}.",
        FONT_IT,
        15,
        page_w - 400,
    )
    y = cy - 215
    for line in lines:
        c.setFillColor(INK)
        c.setFont(FONT_IT, 15)
        c.drawCentredString(page_w / 2, y, line)
        y -= 20

    # Date line.
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 12)
    c.drawCentredString(page_w / 2, y - 34, f"Awarded on {_today()}")

    # Signature block (bottom right).
    bx, by = page_w - 360, 84
    c.setStrokeColor(SLATE)
    c.setLineWidth(1.4)
    c.line(bx, by, bx + 250, by)
    c.setFillColor(INK)
    c.setFont(hand, 34)
    c.drawString(bx + 4, by + 8, "Haile")
    c.setFont(FONT_TB, 11)
    c.setFillColor(NAVY)
    c.drawString(bx, by - 18, "Sir Haile")
    c.setFont(FONT_TR, 9.5)
    c.setFillColor(SLATE)
    c.drawString(bx, by - 32, "Founding Director")

    # Issuer note (bottom left).
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 10)
    c.drawString(70, 84, f"Issued by: {issuer_name}")

    c.showPage()
    buf = c.getpdfdata()  # bytes via internal buffer? see below
    return buf


def build_id_card_pdf(student_full_name: str, student_id: str, grade: str, avatar_url: str) -> bytes:
    """A wallet-style ID card sheet: front face + reverse-side terms."""
    card_w, card_h = 340, 215
    page_w, page_h = portrait(A4)
    c = canvas.Canvas(io.BytesIO(), pagesize=(page_w, page_h))
    x0 = (page_w - card_w) / 2
    y_front = page_h - 250  # front card bottom

    def _card_base(y):
        c.saveState()
        c.translate(x0, y)
        c.setFillColor(colors.white)
        c.roundRect(0, 0, card_w, card_h, 10, stroke=0, fill=1)
        c.setStrokeColor(NAVY)
        c.setLineWidth(2)
        c.roundRect(0, 0, card_w, card_h, 10, stroke=1, fill=0)
        return c

    # ---- Front face ----
    c = _card_base(y_front)
    c.setFillColor(NAVY)
    c.rect(0, card_h - 46, card_w, 46, stroke=0, fill=1)
    c.setFillColor(GOLD_LIGHT)
    c.setFont(FONT_TB, 16)
    c.drawCentredString(card_w / 2, card_h - 33, SCHOOL_NAME)
    c.setFont(FONT_TR, 8.5)
    c.setFillColor(colors.white)
    c.drawCentredString(card_w / 2, card_h - 12, "COMMON EXAMINATION IDENTITY CARD")

    initials = "".join(p[:1] for p in student_full_name.split()[:2]) or "EF"
    _draw_photo(c, initials, avatar_url, 52, 90, 34)

    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8.5)
    c.drawString(102, card_h - 62, "STUDENT NAME")
    c.setFillColor(INK)
    c.setFont(FONT_TB, 13)
    c.drawString(102, card_h - 76, student_full_name)

    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8.5)
    c.drawString(102, card_h - 98, "STUDENT ID")
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 15)
    c.drawString(102, card_h - 114, student_id)

    y_line = 66
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8.5)
    c.drawString(20, y_line, f"Grade: {grade or '—'}")
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 12)
    c.drawRightString(card_w - 20, y_line, "LEARNER")
    c.setFont(FONT_TR, 8)
    c.setFillColor(SLATE)
    c.drawRightString(card_w - 20, y_line - 13, "Valid academic session")
    c.restoreState()

    # ---- Reverse face ----
    y_back = y_front - card_h - 34
    _card_base(y_back)
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 12)
    c.drawString(16, card_h - 26, "CARD TERMS")
    terms = [
        "Present this card to attend live classes and sit examinations.",
        "This card identifies the holder as a registered learner of",
        "Exam Focus Academy. It carries no cash value and is non-transferable.",
        "Loss should be reported to the academy immediately; ID cards are",
        "issued to students who verify their enrolment and take a quiz.",
        "If found, please return this card to the academy reception.",
    ]
    c.setFont(FONT_TR, 9)
    c.setFillColor(INK)
    ty = card_h - 46
    for line in terms:
        c.drawString(16, ty, line)
        ty -= 13
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8.5)
    c.drawString(16, 18, "Issued by Exam Focus Academy")
    c.restoreState()

    c.showPage()
    buf = c.getpdfdata()
    return buf
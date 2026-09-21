"""Generate certificate and student ID-card PDFs with reportlab."""

import hashlib
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
    """Draw a circular photo (or an initials monogram) with a double ring."""
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
    # Monogram fallback (navy fill).
    c.setFillColor(NAVY)
    c.circle(cx, cy + r, r, stroke=0, fill=(img is None))
    if img is None:
        c.setFillColor(colors.white)
        c.setFont(FONT_TB, r * 0.6)
        c.drawCentredString(cx, cy + r * 0.55, initials)
    # Double ring: gold outer, navy inner.
    c.setStrokeColor(GOLD)
    c.setLineWidth(3.2)
    c.circle(cx, cy + r, r + 3.2, stroke=1, fill=0)
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.3)
    c.circle(cx, cy + r, r, stroke=1, fill=0)


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


def _session_label() -> str:
    """Current academic session, e.g. 2026/2027 (September start)."""
    now = datetime.now()
    year = now.year if now.month >= 9 else now.year - 1
    return f"{year}/{year + 1}"


def _barcode(c, text, cx, y, width, height):
    """Deterministic barcode-style bars derived from the given string."""
    digest = hashlib.sha256(text.encode()).digest()
    bars = 38
    slot = width / bars
    x = cx - width / 2
    c.saveState()
    c.setFillColor(INK)
    for i in range(bars):
        b = digest[i % len(digest)]
        w = slot * (1.7 if b % 2 else 0.9)
        h = height * (0.72 if b % 4 == 0 else 1.0)
        c.rect(x, y, max(w, 0.7), h, stroke=0, fill=1)
        x += w + max(0.5, slot * 0.3)
    c.restoreState()


def _card_back(c, x, y, w, h):
    """Cream card base with double frame; coordinates stay on the card origin."""
    c.saveState()
    c.translate(x, y)
    c.setFillColor(CREAM)
    c.roundRect(0, 0, w, h, 12, stroke=0, fill=1)
    c.setStrokeColor(NAVY)
    c.setLineWidth(2.4)
    c.roundRect(1.5, 1.5, w - 3, h - 3, 11, stroke=1, fill=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.9)
    c.roundRect(6, 6, w - 12, h - 12, 8, stroke=1, fill=0)
    c.restoreState()


def _header_band(c, w, h, banner_h, label, sub):
    """Navy header banner nested inside the card frame."""
    inset = 16
    top = h - 8
    bot = top - banner_h
    c.saveState()
    c.setFillColor(NAVY)
    c.roundRect(inset, bot, w - 2 * inset, banner_h, 8, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.setFont(FONT_TB, 15)
    c.drawCentredString(w / 2, top - 15, label)
    c.setFillColor(GOLD_LIGHT)
    c.setLineWidth(0.9)
    c.line(w / 2 - 74, top - 21, w / 2 + 74, top - 21)
    c.setFillColor(colors.white)
    c.setFont(FONT_TR, 8)
    c.drawCentredString(w / 2, top - 33, sub)
    # Corner monogram ring.
    c.setFillColor(GOLD)
    c.circle(w - inset - 18, top - 15, 10, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 7)
    c.drawCentredString(w - inset - 18, top - 18, "EFA")
    c.restoreState()


def _field_label(c, text, x, y, right=False):
    c.setFillColor(GOLD)
    c.setFont(FONT_TR, 7)
    if right:
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def build_id_card_pdf(student_full_name: str, student_id: str, grade: str, avatar_url: str) -> bytes:
    """A wallet-style ID card sheet: a decorated front face + reverse-side terms."""
    card_w, card_h = 360, 225
    page_w, page_h = portrait(A4)
    c = canvas.Canvas(io.BytesIO(), pagesize=(page_w, page_h))
    x0 = (page_w - card_w) / 2
    y_front = page_h - 250  # front card bottom
    inset = 16
    session = _session_label()

    initials = "".join(p[:1] for p in student_full_name.split()[:2]).upper() or "EF"
    hid = (student_id or "").replace(" ", "")
    if not hid:
        hid = f"L-{(int.from_bytes(hashlib.sha256(student_full_name.encode()).digest()[:2], 'big') % 9000) + 1000}"

    # ============================= FRONT FACE =============================
    _card_back(c, x0, y_front, card_w, card_h)
    c.saveState()
    c.translate(x0, y_front)

    # Faint watermark crest on the right of the card body.
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.circle(card_w - 52, 118, 40, stroke=1, fill=0)
    c.circle(card_w - 52, 118, 31, stroke=1, fill=0)
    c.setFillColor(GOLD)
    c.setFont(FONT_TB, 10)
    c.drawCentredString(card_w - 52, 115, "EFA")
    c.restoreState()

    _header_band(c, card_w, card_h, 40, SCHOOL_NAME, "STUDENT IDENTITY CARD")

    # Gold divider under the header.
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(inset, card_h - 66, card_w - inset, card_h - 66)
    c.restoreState()

    # Photo with double ring.
    _draw_photo(c, initials, avatar_url, 60, 126, 30)

    # Text column.
    _field_label(c, "STUDENT NAME", 102, 150)
    c.setFillColor(INK)
    c.setFont(FONT_TB, 13.5)
    c.drawString(102, 134, student_full_name)

    _field_label(c, "STUDENT ID", 102, 112)
    c.setFillColor(NAVY)
    c.setFont(FONT_TB, 17)
    c.drawString(102, 96, hid)

    _field_label(c, "GRADE", 102, 70)
    c.setFillColor(INK)
    c.setFont(FONT_TB, 12)
    c.drawString(102, 56, grade or "—")

    _field_label(c, "ACADEMIC SESSION", card_w - 115, 70, right=True)
    c.setFillColor(INK)
    c.setFont(FONT_TB, 12)
    c.drawRightString(card_w - 115, 56, session)

    # Barcode on the right edge above the footer band.
    bcx, bcy = 300, 54
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(bcx - 50, bcy, bcx + 50, bcy)
    c.restoreState()
    _barcode(c, f"{hid}:{student_full_name}", bcx, bcy + 6, 96, 16)
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 7.5)
    c.drawCentredString(bcx, bcy - 9, hid)

    # Footer band.
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, 0, card_w, 24, stroke=0, fill=1)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.9)
    c.line(0, 24, card_w, 24)
    c.setFillColor(colors.white)
    c.setFont(FONT_TB, 11)
    c.drawString(inset, 14, "LEARNER")
    c.setFont(FONT_TR, 8.5)
    c.drawRightString(card_w - inset, 14, f"VALID ACADEMIC SESSION {session}")
    c.restoreState()

    c.restoreState()

    # ============================ REVERSE FACE ============================
    y_back = y_front - card_h - 34
    _card_back(c, x0, y_back, card_w, card_h)
    c.saveState()
    c.translate(x0, y_back)

    c.setFillColor(NAVY)
    c.roundRect(inset, card_h - 46, card_w - 2 * inset, 30, 8, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont(FONT_TB, 12)
    c.drawString(inset + 12, card_h - 24, "CARD TERMS & INFORMATION")
    c.setFillColor(GOLD_LIGHT)
    c.setFont(FONT_TR, 7.5)
    c.drawString(inset + 12, card_h - 34, "Presented card of registered learner")

    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.9)
    c.line(inset, card_h - 54, card_w - inset, card_h - 54)
    c.restoreState()

    terms = [
        "Present this card to attend live classes, tutorials and examinations.",
        "It identifies the holder as a registered learner of Exam Focus Academy.",
        "This card carries no cash value and is non-transferable.",
        "ID cards are created automatically when a student uploads a profile photo.",
        "Please report or return a lost card to the academy reception immediately.",
    ]
    ty = card_h - 68
    c.saveState()
    c.setFillColor(GOLD)
    for line in terms:
        wrapped = _wrap(c, line, FONT_TR, 9, card_w - 2 * inset - 24)
        for wline in wrapped:
            c.setFillColor(GOLD)
            c.rect(inset + 3, ty + 2, 3, 3, stroke=0, fill=1)
            c.setFillColor(INK)
            c.setFont(FONT_TR, 9)
            c.drawString(inset + 14, ty, wline)
            ty -= 13
    c.restoreState()

    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(inset, ty - 6, card_w - inset, ty - 6)
    c.restoreState()

    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8)
    c.drawString(inset, ty - 22, "ISSUED TO")
    c.setFillColor(INK)
    c.setFont(FONT_TB, 11)
    c.drawString(inset + 58, ty - 22, student_full_name)
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8)
    c.drawString(inset, ty - 36, f"STUDENT ID: {hid}")
    c.setFillColor(SLATE)
    c.setFont(FONT_TR, 8)
    c.drawString(inset, ty - 50, f"Generated from profile photo · {_today()}")

    c.saveState()
    c.setFillColor(GOLD_LIGHT)
    c.rect(0, 0, card_w, 16, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont(FONT_TR, 8)
    c.drawCentredString(card_w / 2, 4.5, "This card is the property of Exam Focus Academy · Please return if found")
    c.restoreState()

    c.restoreState()

    c.showPage()
    buf = c.getpdfdata()
    return buf
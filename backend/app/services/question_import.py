"""Parse questions and answers out of a teacher's PDF / Word / text document and
convert them into the platform's native question format (prompt, options,
correct_answer, explanation) ready for the quiz builder."""

import io
import re

Q_NUM = re.compile(r"^\s*(?:question\s*)?(\d{1,3})\s*[.．)）:：\-•]\s*", re.IGNORECASE)
Q_LABEL = re.compile(r"^\s*[Qq]\s*[-:：]?\s*(?:uestion\s*)?(\d{1,3})\s*[.．)）:：\-]\s*")
OPT = re.compile(r"^\s*\(?([A-Ha-h]|\d{1,2})\)?[.．)）:：]\s*(.*)$")
OPT_LETTER = re.compile(r"^\s*\(?[A-Ha-h]\)?[.．)）:：]\s*(.*)$")
OPT_INLINE = re.compile(r"(?:^|\s)\(?([A-Ha-h]|\d{1,2})\)?[.．)）:：]\s*(?:([A-Za-z0-9].*?))(?=\s*\(?[A-Ha-h\d]{1,2}\)?[.．)）:：]\s|$)")
ANSWER = re.compile(
    r"^\s*(?:(?:correction|right|corect|correct\s+option)\s*[:：]\s*)?(?:the\s+)?(?:correct\s+)?(?:answ?er|ans)(?:s)?(?:\s+is)?\s*[:：]?\s*\(?([A-Ha-h]|\d{1,2})\)?[.．)）]?\s*(.*)$",
    re.IGNORECASE,
)
EXPLAIN = re.compile(r"^\s*(?:explanation|why|reason|solution)\s*[:：]\s*(.*)$", re.IGNORECASE)
KEYLN = re.compile(r"^\s*(\d{1,3})\s*[-.):：]\s*\(?([A-Ha-h]|\d{1,2})\)?\s*$")


def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages or []:
            try:
                pages.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(pages)
    if name.endswith(".docx"):
        import docx
        doc = docx.Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(c.text for c in row.cells))
        return "\n".join(parts)
    if name.endswith((".txt", ".md", ".doc")):
        for enc in ("utf-8", "utf-16", "cp1252", "latin-1"):
            try:
                return data.decode(enc)
            except (UnicodeDecodeError, UnicodeError):
                continue
        return data.decode("latin-1", errors="ignore")
    raise ValueError("Unsupported file type. Upload a PDF (.pdf) or Word (.docx) document.")


def _split_inline_options(lines: list[str]) -> list[str]:
    """Break a single line that contains several options ('A. x B. y') into lines."""
    out = []
    for line in lines:
        hits = list(OPT_INLINE.finditer(line))
        if len(hits) > 1:
            for i, h in enumerate(hits):
                text = line[h.start():]
                if i + 1 < len(hits):
                    text = line[h.start():hits[i + 1].start()]
                out.append(text.strip())
        else:
            out.append(line)
    return [l for l in out if l.strip()]


def _is_key_or_answer_only(lines: list[str]) -> bool:
    for x in lines:
        if ANSWER.match(x) or KEYLN.match(x):
            continue
        if re.match(r"^\s*(answers?|answer\s+key|keys?)\s*[:：]?\s*$", x, re.IGNORECASE):
            continue
        return False
    return True


def _collect_answer_key(text: str) -> dict[int, str]:
    key: dict[int, str] = {}
    for line in text.splitlines():
        m = KEYLN.match(line)
        if m and len(line.strip()) <= 14:
            key[int(m.group(1))] = m.group(2).upper()
        else:
            # Single-line answer keys like "1. A  2. B  3. C".
            for m2 in re.finditer(r"(\d{1,3})\s*[.)-]\s*\(?([A-Ha-h]|\d{1,2})\)?", line):
                key[int(m2.group(1))] = m2.group(2).upper()
    return key


def parse_questions(text: str) -> list[dict]:
    text = text.replace("\r", "\n").replace("\t", " ")
    answer_key = _collect_answer_key(text)
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines() if ln.strip()]

    # Candidate question headers: numbered lines or explicit "Q3:" labels.
    cands: list[tuple[int, int, bool]] = []  # (idx, number, is_label)
    for i, ln in enumerate(lines):
        m = Q_LABEL.match(ln)
        if m:
            cands.append((i, int(m.group(1)), True))
            continue
        if KEYLN.match(ln):
            continue
        m = Q_NUM.match(ln)
        if m:
            cands.append((i, int(m.group(1)), False))

    # Filter out "option-run" impostors: short numbered lines that are really
    # numeric options chasing a real question header (1. time / 2. force / ...).
    starts: list[tuple[int, int]] = []
    last_start = -99
    for i, (idx, key, is_label) in enumerate(cands):
        nxt = cands[i + 1][0] if i + 1 < len(cands) else len(lines)
        between = lines[idx + 1:nxt]
        has_answer = any(ANSWER.match(x) for x in between)
        has_letter_opt = any(OPT_LETTER.match(x) for x in between)
        verbose = len(lines[idx]) >= 24
        short_option_like = (
            (not is_label)
            and len(lines[idx]) <= 18
            and 1 <= key <= 9
            and (idx - last_start) <= 6
            and not (has_answer and not _is_key_or_answer_only(between))
            and not has_letter_opt
            and not verbose
        )
        if short_option_like:
            continue
        starts.append((idx, key))
        last_start = idx

    questions = []
    for k, (s, qnum) in enumerate(starts):
        e = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
        # Cut any trailing answer-key section ("ANSWERS", "1. A", "2. B" ...).
        end = e
        for j in range(s, min(e, len(lines))):
            ln = lines[j]
            if j > s and (KEYLN.match(ln) or re.match(r"^\s*(answers?|answer\s+key|keys?)\s*[:：]?\s*$", ln, re.IGNORECASE)):
                end = j
                break
        block_lines = lines[s:end]

        # The header line is the prompt seed (question number already stripped
        # there by the split), never an option.
        header = _strip_number(block_lines[0])
        prompt_parts: list[str] = []
        options: list[dict] = []
        explanation = ""
        in_explain = False

        for li, line in enumerate(block_lines):
            if li == 0:
                for piece in _split_inline_options([header]):
                    m_opt = OPT.match(piece)
                    if m_opt:
                        letter = m_opt.group(1).upper()
                        opt_text = m_opt.group(2).strip()
                        if opt_text and not _is_answer_or_noise(opt_text):
                            options.append({"key": letter, "text": opt_text})
                        continue
                    if piece.strip():
                        prompt_parts.append(piece)
                continue

            if in_explain:
                m_exp = EXPLAIN.match(line)
                if m_exp or ANSWER.match(line):
                    continue
                explanation = f"{explanation} {line}".strip()
                continue
            m_exp = EXPLAIN.match(line)
            if m_exp:
                explanation = (m_exp.group(1) or "").strip()
                in_explain = True
                continue
            if ANSWER.match(line):
                continue
            for piece in _split_inline_options([line]):
                m_opt = OPT.match(piece)
                if m_opt:
                    letter = m_opt.group(1).upper()
                    opt_text = m_opt.group(2).strip()
                    if opt_text and not _is_answer_or_noise(opt_text):
                        options.append({"key": letter, "text": opt_text})
                    continue
                prompt_parts.append(piece)

        prompt = " ".join(prompt_parts).strip(" :：-–—*#").strip()
        prompt = re.sub(r"\s+", " ", prompt)
        if not prompt:
            continue

        correct_key, inline_explanation = _answer_for_block(block_lines)
        if not correct_key and qnum in answer_key:
            correct_key = answer_key[qnum]
        if inline_explanation and not explanation:
            explanation = inline_explanation

        correct_text = next((o["text"] for o in options if o["key"] == correct_key), None) if correct_key else None
        questions.append(
            {
                "prompt": prompt,
                "question_type": "multiple_choice",
                "options": [o["text"] for o in options],
                "correct_answer": correct_text or "",
                "explanation": explanation,
                "points": 1.0,
            }
        )
    return questions


def _strip_number(line: str) -> str:
    for rx in (Q_LABEL, Q_NUM):
        m = rx.match(line)
        if m:
            return line[m.end():].strip()
    return line


def _is_answer_or_noise(text: str) -> bool:
    t = text.strip().lower()
    return (
        not t
        or re.fullmatch(r"[a-h]", t) is not None
        or t.startswith(("answer:", "ans:", "correct answer", "explanation", "solution"))
    )


def _answer_for_block(lines: list[str]) -> tuple[str | None, str]:
    """Look for 'Answer: B' style markers inside one question block."""
    for line in lines:
        m = ANSWER.match(line)
        if not m:
            continue
        key = m.group(1).upper()
        tail = m.group(2).strip()
        if not tail or len(tail) == 1:
            return key, ""
        return key, tail.strip(" ,.:：()")
    return None, ""
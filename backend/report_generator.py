import os
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table,
    TableStyle, PageBreak
)
from reportlab.platypus import KeepTogether

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "cyberoracle_logo.png")

# ── Brand Colors ──────────────────────────────────────────────────────────────
DARK_BG   = colors.HexColor("#0a0a1a")
NAVY      = colors.HexColor("#0d1b2a")
LAVENDER  = colors.HexColor("#7c3aed")
SKY       = colors.HexColor("#0ea5e9")
MINT      = colors.HexColor("#10b981")
ROSE      = colors.HexColor("#f43f5e")
AMBER     = colors.HexColor("#f59e0b")
WHITE     = colors.white
GRAY      = colors.HexColor("#94a3b8")
LIGHT_GRAY= colors.HexColor("#1e293b")

SEVERITY_COLORS = {
    "Critical": ROSE,
    "High":     colors.HexColor("#f97316"),
    "Medium":   AMBER,
    "Low":      MINT,
    "Info":     SKY,
}


def _styles():
    base = getSampleStyleSheet()
    s = {
        "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=28, textColor=WHITE,
                             alignment=TA_CENTER, spaceAfter=4),
        "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=16, textColor=SKY,
                             spaceBefore=10, spaceAfter=4),
        "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE,
                             spaceBefore=6, spaceAfter=2),
        "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=10, textColor=GRAY,
                              alignment=TA_CENTER, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9, textColor=GRAY,
                               spaceAfter=4, leading=14),
        "badge_crit": ParagraphStyle("badge_crit", fontName="Helvetica-Bold", fontSize=8,
                                     textColor=WHITE, alignment=TA_CENTER),
        "mono": ParagraphStyle("mono", fontName="Courier", fontSize=8, textColor=MINT,
                               backColor=LIGHT_GRAY, leftIndent=4, spaceAfter=4),
        "right": ParagraphStyle("right", fontName="Helvetica", fontSize=8, textColor=GRAY,
                                alignment=TA_RIGHT),
    }
    return s


def _severity_badge(severity: str) -> str:
    color_map = {
        "Critical": "#f43f5e", "High": "#f97316",
        "Medium": "#f59e0b",   "Low": "#10b981",
    }
    c = color_map.get(severity, "#64748b")
    return f'<font color="{c}"><b>[{severity.upper()}]</b></font>'


def generate_report(scan, client, output_path: str):
    """
    Generate a professional PDF security assessment report.

    :param scan: Scan ORM object (with .hosts, .ai_summary, etc.)
    :param client: Client ORM object
    :param output_path: File path to write the PDF
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title=f"CyberOracle Security Assessment — {client.name}",
        author="CyberOracle Security Intelligence Platform"
    )

    S = _styles()
    story = []

    # ── Cover Page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20*mm))

    # Logo
    if os.path.exists(LOGO_PATH):
        try:
            img = Image(LOGO_PATH, width=60*mm, height=60*mm)
            img.hAlign = "CENTER"
            story.append(img)
        except Exception:
            pass

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("CyberOracle", S["h1"]))
    story.append(Paragraph("Security Intelligence Platform", S["sub"]))
    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=LAVENDER))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("SECURITY ASSESSMENT REPORT", ParagraphStyle(
        "cover_title", fontName="Helvetica-Bold", fontSize=18, textColor=WHITE, alignment=TA_CENTER
    )))
    story.append(Spacer(1, 10*mm))

    # Meta table
    meta = [
        ["Client", client.name],
        ["Engagement Target", scan.target],
        ["Scan Status", scan.status.capitalize()],
        ["Date", scan.started_at.strftime("%Y-%m-%d %H:%M UTC") if scan.started_at else "—"],
        ["Completed", scan.finished_at.strftime("%Y-%m-%d %H:%M UTC") if scan.finished_at else "—"],
        ["Hosts Discovered", str(len(scan.hosts))],
    ]
    meta_table = Table(meta, colWidths=[55*mm, 110*mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1), LIGHT_GRAY),
        ("BACKGROUND",    (1, 0), (1, -1), NAVY),
        ("TEXTCOLOR",     (0, 0), (0, -1), SKY),
        ("TEXTCOLOR",     (1, 0), (1, -1), WHITE),
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [LIGHT_GRAY, NAVY]),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#1e293b")),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=LAVENDER))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "CONFIDENTIAL — This report is intended solely for the use of the named client. "
        "Unauthorized disclosure is prohibited.",
        ParagraphStyle("conf", fontName="Helvetica-Oblique", fontSize=8, textColor=GRAY, alignment=TA_CENTER)
    ))
    story.append(PageBreak())

    # ── AI Executive Summary ─────────────────────────────────────────────────
    story.append(Paragraph("Executive Summary", S["h2"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LAVENDER, spaceAfter=6))

    if scan.ai_summary:
        for line in scan.ai_summary.split("\n"):
            if line.strip():
                story.append(Paragraph(line.strip(), S["body"]))
    else:
        story.append(Paragraph("No AI summary available for this scan.", S["body"]))

    story.append(Spacer(1, 8*mm))

    # ── Host Discovery Table ──────────────────────────────────────────────────
    story.append(Paragraph("Discovered Hosts", S["h2"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LAVENDER, spaceAfter=6))

    host_data = [["IP Address", "Hostname", "OS Guess", "Open Ports"]]
    for host in scan.hosts:
        host_data.append([
            host.ip,
            host.hostname or "—",
            host.os_guess or "Unknown",
            str(len(host.ports))
        ])

    if len(host_data) > 1:
        host_table = Table(host_data, colWidths=[40*mm, 60*mm, 40*mm, 25*mm])
        host_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), LAVENDER),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [NAVY, LIGHT_GRAY]),
            ("TEXTCOLOR",     (0, 1), (-1, -1), GRAY),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#334155")),
            ("ALIGN",         (3, 0), (3, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(host_table)
    else:
        story.append(Paragraph("No hosts discovered.", S["body"]))

    story.append(PageBreak())

    # ── Per-Host Detailed Findings ────────────────────────────────────────────
    story.append(Paragraph("Detailed Findings", S["h2"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LAVENDER, spaceAfter=6))

    if not scan.hosts:
        story.append(Paragraph("No hosts found.", S["body"]))
    
    for host in scan.hosts:
        block = []
        block.append(Paragraph(
            f"🖥  {host.ip}  {('— ' + host.hostname) if host.hostname else ''}  |  {host.os_guess}",
            S["h3"]
        ))

        if not host.ports:
            block.append(Paragraph("No open ports found on this host.", S["body"]))
        else:
            port_data = [["Port", "Service", "Banner", "CVE", "Severity"]]
            for port in host.ports:
                port_data.append([
                    str(port.port),
                    port.service,
                    (port.banner[:40] + "…") if len(port.banner) > 40 else (port.banner or "—"),
                    port.cve or "—",
                    port.severity or "—"
                ])
            
            port_table = Table(port_data, colWidths=[15*mm, 28*mm, 55*mm, 32*mm, 22*mm])

            # Severity row colors
            row_styles = [
                ("BACKGROUND",    (0, 0), (-1, 0), LAVENDER),
                ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
                ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",      (0, 0), (-1, -1), 7.5),
                ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#334155")),
                ("ALIGN",         (0, 0), (1, -1), "CENTER"),
                ("ALIGN",         (4, 0), (4, -1), "CENTER"),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",    (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
            for i, row in enumerate(port_data[1:], start=1):
                sev = row[4]
                bg = SEVERITY_COLORS.get(sev, LIGHT_GRAY)
                # Alternate row bg
                row_bg = NAVY if i % 2 == 0 else LIGHT_GRAY
                row_styles.append(("BACKGROUND", (0, i), (-1, i), row_bg))
                row_styles.append(("TEXTCOLOR",  (0, i), (-1, i), GRAY))
                if sev in SEVERITY_COLORS:
                    row_styles.append(("TEXTCOLOR",  (4, i), (4, i), SEVERITY_COLORS[sev]))
                    row_styles.append(("FONTNAME",   (4, i), (4, i), "Helvetica-Bold"))

            port_table.setStyle(TableStyle(row_styles))
            block.append(port_table)

        block.append(Spacer(1, 5*mm))
        story.append(KeepTogether(block))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LAVENDER))
    story.append(Paragraph(
        f"Generated by CyberOracle Security Intelligence Platform  |  {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("footer", fontName="Helvetica-Oblique", fontSize=7, textColor=GRAY, alignment=TA_CENTER, spaceBefore=4)
    ))

    # ── Build with dark background ────────────────────────────────────────────
    def add_dark_bg(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(DARK_BG)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canvas.restoreState()

    doc.build(story, onFirstPage=add_dark_bg, onLaterPages=add_dark_bg)

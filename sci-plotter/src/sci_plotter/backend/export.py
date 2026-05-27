"""高级导出：matplotlib 矢量图、PDF 报告"""

from pathlib import Path


def export_as_vector(figure_data: dict, fmt: str, output_path: str):
    """使用 matplotlib 导出矢量图"""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    width = figure_data.get("width", 1200)
    height = figure_data.get("height", 800)
    bg_color = figure_data.get("bgColor", "#ffffff")
    layers = figure_data.get("layers", [])

    fig, ax = plt.subplots(figsize=(width / 100, height / 100))
    fig.patch.set_facecolor(bg_color)
    ax.set_facecolor(bg_color)
    ax.set_xlim(0, width)
    ax.set_ylim(height, 0)
    ax.axis("off")
    ax.set_position([0, 0, 1, 1])

    for layer in layers:
        _draw_layer(ax, layer)

    if fmt == "svg":
        fig.savefig(output_path, format="svg", bbox_inches="tight", pad_inches=0)
    elif fmt == "pdf":
        fig.savefig(output_path, format="pdf", bbox_inches="tight", pad_inches=0)
    else:
        raise ValueError(f"不支持的矢量格式: {fmt}")

    plt.close(fig)


def _draw_layer(ax, layer: dict):
    """将单个 layer 绘制到 matplotlib axes 上"""
    ltype = layer.get("type")
    left = layer.get("left", 0)
    top = layer.get("top", 0)
    w = layer.get("width", 100)
    h = layer.get("height", 100)

    if ltype == "text":
        text = layer.get("text", "")
        ax.text(left, top, text, fontsize=12)
    elif ltype in ("rect", "subfigure", "image"):
        from matplotlib.patches import Rectangle
        rect = Rectangle((left, top), w, h, linewidth=1, edgecolor="black", facecolor="none")
        ax.add_patch(rect)
    elif ltype == "circle":
        from matplotlib.patches import Circle
        circle = Circle((left + w / 2, top + h / 2), min(w, h) / 2, linewidth=1, edgecolor="black", facecolor="none")
        ax.add_patch(circle)


def export_as_pdf(figure_data: dict, output_path: str):
    """使用 reportlab 导出 PDF 报告"""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as pdf_canvas

    c = pdf_canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 50, "SCI-Plotter Report")

    c.setFont("Helvetica", 10)
    c.drawString(50, height - 70, f"Canvas: {figure_data.get('width', 0)} x {figure_data.get('height', 0)}")

    c.showPage()
    c.save()

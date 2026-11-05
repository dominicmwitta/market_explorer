from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

def create_icon(size, output_path):
    bg_color = (30, 58, 95)
    fg_color = (255, 255, 255)

    img = Image.new('RGBA', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    chart_width = size * 0.6
    chart_height = size * 0.4
    start_x = (size - chart_width) / 2
    start_y = size * 0.35

    points = [
        (start_x, start_y + chart_height),
        (start_x, start_y + chart_height * 0.6),
        (start_x + chart_width * 0.3, start_y + chart_height * 0.4),
        (start_x + chart_width * 0.5, start_y + chart_height * 0.7),
        (start_x + chart_width * 0.7, start_y + chart_height * 0.2),
        (start_x + chart_width, start_y),
    ]

    line_width = max(2, size // 16)
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=(76, 175, 80), width=line_width)

    for x, y in points:
        r = max(2, size // 20)
        draw.ellipse([x-r, y-r, x+r, y+r], fill=fg_color)

    img.save(output_path, 'PNG')

def main():
    icons_dir = Path(__file__).parent / 'icons'
    icons_dir.mkdir(exist_ok=True)

    sizes = [72, 96, 128, 144, 152, 192, 384, 512]

    for size in sizes:
        output_path = icons_dir / f'icon-{size}x{size}.png'
        create_icon(size, output_path)
        print(f'Created {output_path}')

    print('All icons created successfully!')

if __name__ == '__main__':
    main()

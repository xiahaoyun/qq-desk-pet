from pathlib import Path

from PIL import Image


ROOT = Path("public/assets")
POSE_ROOT = ROOT / "generated" / "single-poses"
KEY_POSE_ROOT = ROOT / "generated" / "key-poses"
ACTIONS = ["idle", "walk", "sit", "jump", "wave", "sleep"]
FRAME_COUNT = 8
CANVAS_SIZE = 512
MAX_PET_SIZE = 430

MOTIONS = {
    "idle": [
        (0, 0, 100, 0),
        (0, 1, 101, 0),
        (0, 2, 101, 0),
        (0, 1, 100, 0),
        (0, 0, 100, 0),
        (0, 1, 101, 0),
        (0, 2, 101, 0),
        (0, 1, 100, 0),
    ],
    "walk": [
        (-7, 1, 100, -1),
        (-3, -2, 101, 1),
        (2, 0, 100, -1),
        (6, -2, 101, 1),
        (7, 1, 100, -1),
        (3, -2, 101, 1),
        (-2, 0, 100, -1),
        (-6, -2, 101, 1),
    ],
    "sit": [
        (0, 0, 100, 0),
        (0, 1, 100, 0),
        (0, 1, 101, 0),
        (0, 2, 101, 0),
        (0, 1, 100, 0),
        (0, 0, 100, 0),
        (0, 1, 100, 0),
        (0, 1, 101, 0),
    ],
    "jump": [
        (0, 15, 96, -2),
        (0, 4, 99, 0),
        (0, -24, 101, 2),
        (0, -48, 102, 0),
        (0, -31, 101, -2),
        (0, 0, 99, 1),
        (0, 10, 97, 0),
        (0, 3, 100, 0),
    ],
    "wave": [
        (0, 0, 100, -2),
        (0, -1, 101, 1),
        (0, 0, 100, 3),
        (0, 1, 101, -1),
        (0, 0, 100, -3),
        (0, -1, 101, 1),
        (0, 0, 100, 3),
        (0, 1, 101, -1),
    ],
    "sleep": [
        (0, 0, 100, 0),
        (0, 1, 101, 0),
        (0, 2, 102, 0),
        (0, 1, 101, 0),
        (0, 0, 100, 0),
        (0, 1, 101, 0),
        (0, 2, 102, 0),
        (0, 1, 101, 0),
    ],
}

KEY_POSE_SEQUENCES = {
    "idle": [0, 0, 2, 0, 1, 0, 2, 0],
    "sit": [1, 2, 1, 3, 1, 2, 1, 3],
    "jump": [0, 1, 2, 2, 1, 0, 0, 0],
    "walk": [0, 1, 2, 1, 0, 2, 1, 0],
    "wave": [2, 0, 1, 3, 1, 0, 2, 0],
    "sleep": [0, 0, 1, 1, 0, 0, 1, 1],
}


def remove_green(image):
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if g > 135 and g > r * 1.25 and g > b * 1.25:
                pixels[x, y] = (0, 0, 0, 0)
    return image


def crop_to_subject(image):
    box = image.getbbox()
    if not box:
        return image
    return image.crop(box)


def normalize_source(source):
    image = crop_to_subject(remove_green(Image.open(source)))
    image.thumbnail((MAX_PET_SIZE, MAX_PET_SIZE), Image.Resampling.LANCZOS)
    normalized = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    normalized.paste(
        image,
        ((CANVAS_SIZE - image.width) // 2, (CANVAS_SIZE - image.height) // 2),
        image,
    )
    return normalized


def normalize_pose(action):
    source = POSE_ROOT / f"qq-{action}-pose-source.png"
    return normalize_source(source)


def normalize_key_poses(action):
    key_dir = KEY_POSE_ROOT / action
    sources = sorted(key_dir.glob("frame-*.png"))
    if not sources:
        return []

    subjects = [crop_to_subject(remove_green(Image.open(source))) for source in sources]
    max_width = max(subject.width for subject in subjects)
    max_height = max(subject.height for subject in subjects)
    scale = min(MAX_PET_SIZE / max_width, MAX_PET_SIZE / max_height)
    output_width = max(1, round(max_width * scale))
    output_height = max(1, round(max_height * scale))

    normalized = []
    for subject in subjects:
        scaled_width = max(1, round(subject.width * scale))
        scaled_height = max(1, round(subject.height * scale))
        scaled = subject.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
        box = Image.new("RGBA", (output_width, output_height), (0, 0, 0, 0))
        box.paste(
            scaled,
            ((output_width - scaled_width) // 2, output_height - scaled_height),
            scaled,
        )
        canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
        canvas.paste(
            box,
            ((CANVAS_SIZE - output_width) // 2, (CANVAS_SIZE - output_height) // 2),
            box,
        )
        normalized.append(canvas)
    return normalized


def motion_frame(base, dx, dy, scale_percent, angle):
    box = base.getbbox()
    if not box:
        return base.copy()
    subject = base.crop(box)
    scaled_width = max(1, round(subject.width * scale_percent / 100))
    scaled_height = max(1, round(subject.height * scale_percent / 100))
    transformed = subject.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
    if angle:
        transformed = transformed.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    center_x = (box[0] + box[2]) // 2 + dx
    center_y = (box[1] + box[3]) // 2 + dy
    canvas.paste(
        transformed,
        (center_x - transformed.width // 2, center_y - transformed.height // 2),
        transformed,
    )
    return canvas


def build_action(action):
    key_poses = normalize_key_poses(action)
    if key_poses:
        sequence = KEY_POSE_SEQUENCES.get(action, list(range(len(key_poses))))
        frame_dir = ROOT / f"qq-{action}-frames"
        frame_dir.mkdir(exist_ok=True)
        frames = []
        for index, key_index in enumerate(sequence):
            frame = key_poses[key_index].copy()
            frame.save(frame_dir / f"frame-{index + 1:02d}.png")
            frames.append(frame)
        save_animation(action, frames)
        return

    base = normalize_pose(action)
    frame_dir = ROOT / f"qq-{action}-frames"
    frame_dir.mkdir(exist_ok=True)

    frames = []
    for index, motion in enumerate(MOTIONS[action]):
        frame = motion_frame(base, *motion)
        frame.save(frame_dir / f"frame-{index + 1:02d}.png")
        frames.append(frame)

    save_animation(action, frames)


def save_animation(action, frames):
    duration = 180 if action != "sleep" else 260
    frames[0].save(
        ROOT / f"qq-{action}.webp",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        lossless=True,
        quality=90,
        method=6,
    )
    frames[0].save(
        ROOT / f"qq-{action}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        transparency=0,
    )


for action_name in ACTIONS:
    build_action(action_name)

print("rebuilt QQ action animations from single/key-pose sources")

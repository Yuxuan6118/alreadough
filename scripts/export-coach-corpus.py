"""Export the local research corpus. It is source material, not API-ready training pairs."""

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "research_notes" / "显化三流派导师理论"
NOTE_SCHOOLS = {
    "kejitu": ["assumption", "release", "subconscious"],
    "yuzi": ["release", "assumption"],
    "beiguo": ["release", "assumption"],
    "yinian": ["assumption", "release", "subconscious"],
    "xiaozhu": ["assumption", "subconscious"],
}
SCHOOLS = ["assumption", "release", "subconscious"]


def note_record(path):
    note = json.loads(path.read_text(encoding="utf-8"))
    comments = []
    for comment in note["comments"]:
        comments.append({
            "id": comment.get("id"),
            "text": comment.get("t"),
            "author": bool(comment.get("author")),
            "replies": [
                {"text": reply.get("t"), "author": bool(reply.get("author"))}
                for reply in comment.get("subs", [])
            ],
        })
    return {
        "kind": "note",
        "id": note["id"],
        "source": path.relative_to(ROOT).as_posix(),
        "school_candidates": NOTE_SCHOOLS[path.parent.name],
        "title": note["title"],
        "caption": note.get("desc"),
        "image_ocr": note.get("image_text", []),
        "author_comment_image_ocr": note.get("author_comment_image_text", {}),
        "comments": comments,
        "comments_have_more": note.get("commentsHasMore"),
        "reply_buttons_not_expanded": note.get("skippedButtons"),
    }


def records():
    for path in sorted(ROOT.glob("xhs_raw/*/*.json")):
        yield note_record(path)
    for path in sorted([*ROOT.glob("*.md"), *ROOT.glob("xhs_analysis/*.md")]):
        prefix = path.stem.split("_")[0]
        schools = [prefix] if prefix in SCHOOLS else NOTE_SCHOOLS.get(prefix, SCHOOLS)
        yield {
            "kind": "research",
            "source": path.relative_to(ROOT).as_posix(),
            "school_candidates": schools,
            "text": path.read_text(encoding="utf-8"),
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    counts = Counter()
    with args.output.open("w", encoding="utf-8") as output:
        for record in records():
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
            counts[record["kind"]] += 1
            if record["kind"] == "note":
                counts["image_ocr"] += len(record["image_ocr"])
                counts["comments"] += len(record["comments"])
                counts["replies"] += sum(len(comment["replies"]) for comment in record["comments"])
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()

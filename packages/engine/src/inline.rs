//! Inline text shaping belongs to the font measurer; line breaking and fragment placement
//! belong to this kernel. Source ranges are UTF-16, matching the editor and CanvasKit.
use serde::{Deserialize, Serialize};
use unicode_linebreak::linebreaks;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextCluster {
    pub start: usize,
    pub end: usize,
    pub width: f32,
    pub height: f32,
    pub baseline: f32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InlineText {
    pub text: String,
    pub clusters: Vec<TextCluster>,
    #[serde(default)]
    pub nowrap: bool,
    #[serde(default)]
    pub break_all: bool,
    #[serde(default)]
    pub keep_all: bool,
    #[serde(default)]
    pub preserve_spaces: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct InlineFragment {
    pub start: usize,
    pub end: usize,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub baseline: f32,
}

pub struct InlineItem {
    pub text: Option<std::rc::Rc<InlineText>>,
    pub width: f32,
    pub height: f32,
    pub baseline: f32,
    /// Baseline to the atom's top; middle alignment uses the container's x-height.
    pub middle: bool,
}

pub struct InlineLayout {
    pub fragments: Vec<Vec<InlineFragment>>,
    pub width: f32,
    pub height: f32,
    pub baseline: f32,
}

#[derive(Clone)]
struct Unit {
    owner: usize,
    start: usize,
    end: usize,
    end_byte: usize,
    width: f32,
    height: f32,
    baseline: f32,
    space: bool,
    hard: bool,
    nowrap: bool,
    break_all: bool,
    keep_all: bool,
    cjk: bool,
}

fn utf16_bytes(text: &str) -> Vec<usize> {
    let mut out = vec![0];
    for (at, ch) in text.char_indices() {
        if ch.len_utf16() == 2 {
            out.push(at);
        }
        out.push(at + ch.len_utf8());
    }
    out
}

/// CSS inline flow for shaped text and atomic inline siblings. NBSP glue and punctuation
/// opportunities are computed across element boundaries, rather than breaking at every span.
pub fn layout(
    items: &[InlineItem],
    available: f32,
    strut: f32,
    base: f32,
    x_height: f32,
) -> InlineLayout {
    let mut units = Vec::<Unit>::new();
    let mut text = String::new();
    for (owner, item) in items.iter().enumerate() {
        if let Some(shaped) = &item.text {
            let bytes = utf16_bytes(&shaped.text);
            for cluster in &shaped.clusters {
                let value = &shaped.text[bytes[cluster.start]..bytes[cluster.end]];
                text.push_str(value);
                let space =
                    !shaped.preserve_spaces && value.chars().all(|ch| ch == ' ' || ch == '\t');
                units.push(Unit { owner, start: cluster.start, end: cluster.end,
                    end_byte: text.len(), width: cluster.width, height: cluster.height,
                    baseline: cluster.baseline, space, hard: value == "\n",
                    nowrap: shaped.nowrap, break_all: shaped.break_all, keep_all: shaped.keep_all,
                    cjk: value.chars().any(|ch| matches!(ch as u32, 0x2e80..=0x9fff | 0xac00..=0xd7af | 0xf900..=0xfaff)) });
            }
        } else {
            text.push('\u{fffc}');
            units.push(Unit {
                owner,
                start: 0,
                end: 0,
                end_byte: text.len(),
                width: item.width,
                height: item.height,
                baseline: if item.middle {
                    item.height / 2.0 + x_height / 2.0
                } else {
                    item.baseline
                },
                space: false,
                hard: false,
                nowrap: false,
                break_all: false,
                keep_all: false,
                cjk: false,
            });
        }
    }
    // Byte offsets after which UAX14 allows a break; the loop only asks membership.
    let mut opportunities = vec![false; text.len() + 1];
    for (at, _) in linebreaks(&text) {
        opportunities[at] = true;
    }
    let mut out = InlineLayout {
        fragments: vec![Vec::new(); items.len()],
        width: 0.0,
        height: 0.0,
        baseline: 0.0,
    };
    let mut begin = 0;
    while begin < units.len() {
        // Collapsible spaces disappear at a line boundary (CSS Text 3 §4.1.2).
        while begin < units.len() && units[begin].space {
            begin += 1;
        }
        if begin == units.len() {
            break;
        }
        let mut end = begin;
        let mut width = 0.0;
        let mut last_break = None;
        while end < units.len() {
            let unit = &units[end];
            let advance = if unit.space && end > begin && units[end - 1].space {
                0.0
            } else {
                unit.width
            };
            // Whitespace may hang past the edge; its break is still usable before the next word.
            if !unit.space && !unit.hard && available >= 0.0 && width + advance > available + 0.01 {
                if let Some(at) = last_break {
                    end = at;
                    break;
                }
            }
            width += advance;
            end += 1;
            if unit.hard {
                break;
            }
            let same_span = end < units.len() && units[end].owner == unit.owner;
            let glued = same_span && unit.nowrap;
            let cjk_kept = same_span && unit.keep_all && unit.cjk && units[end].cjk;
            if !glued && !cjk_kept && (opportunities[unit.end_byte] || unit.break_all)
            {
                last_break = Some(end);
            }
        }
        if end == begin {
            end += 1;
        }
        let mut visible_end = end;
        while visible_end > begin && (units[visible_end - 1].space || units[visible_end - 1].hard) {
            visible_end -= 1;
        }
        let mut ascent = base;
        let mut descent = (strut - base).max(0.0);
        for unit in &units[begin..visible_end] {
            ascent = ascent.max(unit.baseline);
            descent = descent.max(unit.height - unit.baseline);
        }
        let height = ascent + descent;
        let mut x = 0.0;
        for (offset, unit) in units[begin..visible_end].iter().enumerate() {
            let advance = if unit.space && offset > 0 && units[begin + offset - 1].space {
                0.0
            } else {
                unit.width
            };
            let y = out.height + ascent - unit.baseline;
            let fragments = &mut out.fragments[unit.owner];
            if let Some(previous) = fragments.last_mut().filter(|f| {
                f.end == unit.start && (f.y - y).abs() < 0.01 && f.height == unit.height
            }) {
                previous.end = unit.end;
                previous.width += advance;
            } else {
                fragments.push(InlineFragment {
                    start: unit.start,
                    end: unit.end,
                    x,
                    y,
                    width: advance,
                    height: unit.height,
                    baseline: unit.baseline,
                });
            }
            x += advance;
        }
        out.width = out.width.max(x);
        out.baseline = out.height + ascent;
        out.height += height;
        begin = end;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> InlineItem {
        let mut offset = 0;
        InlineItem {
            text: Some(std::rc::Rc::new(InlineText {
                text: value.into(),
                clusters: value
                    .chars()
                    .map(|c| {
                        let start = offset;
                        offset += c.len_utf16();
                        TextCluster {
                            start,
                            end: offset,
                            width: 10.0,
                            height: 20.0,
                            baseline: 15.0,
                        }
                    })
                    .collect(),
                ..Default::default()
            })),
            width: 0.0,
            height: 20.0,
            baseline: 15.0,
            middle: false,
        }
    }
    #[test]
    fn suffix_uses_last_text_line_and_nbsp_keeps_last_word_attached() {
        let items = [
            text("one two three"),
            text("\u{a0}"),
            InlineItem {
                text: None,
                width: 8.0,
                height: 8.0,
                baseline: 8.0,
                middle: false,
            },
        ];
        let result = layout(&items, 100.0, 20.0, 15.0, 8.0);
        assert_eq!(result.height, 40.0);
        assert_eq!(result.fragments[0].len(), 2);
        assert_eq!(result.fragments[2][0].x, 60.0);
        assert_eq!(result.fragments[2][0].y, 27.0);
    }
    #[test]
    fn line_breaks_cross_text_nodes_and_keep_punctuation_and_emoji_ranges() {
        let result = layout(&[text("你好世界"), text("\u{a0}😀")], 40.0, 20.0, 15.0, 8.0);
        assert_eq!(result.height, 40.0);
        assert_eq!(result.fragments[1][0].end, 3);
        assert_eq!(result.fragments[1][0].y, 20.0);
    }
}

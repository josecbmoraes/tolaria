//! Pure text-processing helpers for markdown content parsing.
//! Snippet extraction, markdown stripping, date parsing, and string utilities.

use chrono::{DateTime, FixedOffset};

#[derive(Clone, Copy)]
struct TextSlice<'a>(&'a str);

impl<'a> TextSlice<'a> {
    fn as_str(self) -> &'a str {
        self.0
    }
}

/// Derive a human-readable title from a filename stem (slug).
/// Converts hyphens to spaces and title-cases each word.
/// Example: `career-tracks-depend-on-company-shape` → `Career Tracks Depend on Company Shape`
pub(super) fn slug_to_title(stem: &str) -> String {
    stem.split('-')
        .filter(|s| !s.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(c) => {
                    let upper: String = c.to_uppercase().collect();
                    format!("{}{}", upper, chars.as_str())
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract the H1 title from the first non-empty line of the body (after frontmatter).
/// Returns `None` if no H1 is found on the first non-empty line.
pub(super) fn extract_h1_title(content: &str) -> Option<String> {
    let body = strip_frontmatter(TextSlice(content));
    let title =
        first_non_empty_line(TextSlice(body)).and_then(|line| markdown_h1_text(TextSlice(line)))?;
    let stripped = strip_markdown_chars(TextSlice(title));
    non_empty_trimmed(TextSlice(&stripped)).map(str::to_string)
}

fn non_empty_trimmed(value: TextSlice<'_>) -> Option<&str> {
    let trimmed = value.as_str().trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn first_non_empty_line(value: TextSlice<'_>) -> Option<&str> {
    value
        .as_str()
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
}

fn markdown_h1_text(line: TextSlice<'_>) -> Option<&str> {
    line.as_str()
        .strip_prefix("# ")
        .and_then(|text| non_empty_trimmed(TextSlice(text)))
}

/// Extract the display title for a note.
/// Priority: H1 on first non-empty line → frontmatter `title:` → filename-derived title.
pub(super) fn extract_title(fm_title: Option<&str>, content: &str, filename: &str) -> String {
    // 1. H1 on first non-empty line of body
    if let Some(h1) = extract_h1_title(content) {
        return h1;
    }
    // 2. frontmatter title (legacy, backward compat)
    if let Some(title) = fm_title {
        if !title.is_empty() {
            return title.to_string();
        }
    }
    // 3. filename slug
    let stem = filename.strip_suffix(".md").unwrap_or(filename);
    slug_to_title(stem)
}

/// Remove YAML frontmatter (triple-dash delimited) from content.
/// The closing `---` must appear at the start of a line to avoid matching
/// occurrences inside frontmatter values (e.g. `title: foo---bar`).
fn strip_frontmatter(content: TextSlice<'_>) -> &str {
    let value = content.as_str();
    let Some(rest) = value.strip_prefix("---") else {
        return value;
    };
    // Find closing `---` at the start of a line (preceded by newline)
    match rest.find("\n---") {
        Some(end) => {
            let after = end + 4; // skip past "\n---"
            rest[after..].trim_start()
        }
        None => value,
    }
}

/// Check if a line is useful for snippet extraction (not blank, heading, code fence, or rule).
fn is_snippet_line(line: TextSlice<'_>) -> bool {
    let t = line.as_str().trim();
    !t.is_empty() && !t.starts_with('#') && !t.starts_with("```") && !t.starts_with("---")
}

/// Extract sub-heading text (## , ### , etc.) stripped of the `#` prefix.
fn extract_subheading_text(line: TextSlice<'_>) -> Option<&str> {
    let t = line.as_str().trim();
    let stripped = t.trim_start_matches('#');
    if stripped.len() < t.len() && stripped.starts_with(' ') {
        let text = stripped.trim();
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

/// Strip leading list markers (*, -, +, 1.) from a line.
fn strip_list_marker(line: TextSlice<'_>) -> &str {
    let t = line.as_str().trim_start();
    strip_unordered_marker(TextSlice(t))
        .or_else(|| strip_ordered_marker(TextSlice(t)))
        .unwrap_or(t)
}

/// Strip unordered list markers: "* ", "- ", "+ "
fn strip_unordered_marker(s: TextSlice<'_>) -> Option<&str> {
    ["* ", "- ", "+ "]
        .iter()
        .find_map(|prefix| s.as_str().strip_prefix(prefix))
}

/// Strip ordered list markers: "1. ", "2. ", etc.
fn strip_ordered_marker(s: TextSlice<'_>) -> Option<&str> {
    let value = s.as_str();
    let dot_pos = value.find(". ")?;
    if dot_pos <= 3 && value[..dot_pos].chars().all(|c| c.is_ascii_digit()) {
        Some(&value[dot_pos + 2..])
    } else {
        None
    }
}

/// Truncate a string to `max_len` bytes at a valid UTF-8 boundary, appending "...".
fn truncate_with_ellipsis(s: TextSlice<'_>, max_len: usize) -> String {
    let value = s.as_str();
    if value.len() <= max_len {
        return value.to_string();
    }
    let mut idx = max_len;
    while idx > 0 && !value.is_char_boundary(idx) {
        idx -= 1;
    }
    format!("{}...", &value[..idx])
}

/// Count the number of words in the note body (excluding frontmatter and H1 title).
pub(super) fn count_body_words(content: &str) -> u32 {
    let without_fm = strip_frontmatter(TextSlice(content));
    let body = without_h1_line(TextSlice(without_fm)).unwrap_or(without_fm);
    body.split_whitespace()
        .filter(|w| {
            !w.chars()
                .all(|c| matches!(c, '#' | '*' | '_' | '`' | '~' | '-' | '>' | '|'))
        })
        .count() as u32
}

/// Extract a snippet: first ~160 chars of content after frontmatter/title, stripped of markdown.
pub(super) fn extract_snippet(content: &str) -> String {
    let without_fm = strip_frontmatter(TextSlice(content));
    let body = without_h1_line(TextSlice(without_fm)).unwrap_or(without_fm);
    let without_activity = content_without_first_activity_section(body);
    let clean: String = without_activity
        .lines()
        .filter(|line| is_snippet_line(TextSlice(line)))
        .map(|line| strip_list_marker(TextSlice(line)))
        .collect::<Vec<&str>>()
        .join(" ");
    let stripped = strip_markdown_chars(TextSlice(&clean));
    let trimmed = stripped.trim();
    if !trimmed.is_empty() {
        return truncate_with_ellipsis(TextSlice(trimmed), 160);
    }
    // Fallback: collect sub-heading text when no paragraph content exists
    let heading_text: String = without_activity
        .lines()
        .filter_map(|line| extract_subheading_text(TextSlice(line)))
        .collect::<Vec<&str>>()
        .join(" ");
    let heading_trimmed = strip_markdown_chars(TextSlice(&heading_text));
    let heading_trimmed = heading_trimmed.trim();
    if heading_trimmed.is_empty() {
        return String::new();
    }
    truncate_with_ellipsis(TextSlice(heading_trimmed), 160)
}

/// Remove the first H2 Activity section and its contents, preserving later sections.
fn content_without_first_activity_section(content: &str) -> String {
    let mut active_fence = None;
    let mut skipping_activity = false;
    let mut activity_removed = false;
    let mut kept_lines = Vec::new();

    for line in content.lines() {
        let is_h2 = active_fence.is_none() && is_level_two_heading(line);
        let is_activity = is_h2 && is_activity_heading(line);

        if is_activity && !activity_removed {
            skipping_activity = true;
            activity_removed = true;
        } else if skipping_activity && is_h2 {
            skipping_activity = false;
            kept_lines.push(line);
        } else if !skipping_activity {
            kept_lines.push(line);
        }

        active_fence = next_markdown_fence(line, active_fence);
    }

    kept_lines.join("\n")
}

fn without_h1_line(s: TextSlice<'_>) -> Option<&str> {
    let value = s.as_str();
    let mut offset = 0;
    for line in value.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\r', '\n']).trim();
        if trimmed.starts_with("# ") {
            return Some(&value[offset + line.len()..]);
        }
        // If we hit non-empty non-heading content first, there's no H1 to skip
        if !trimmed.is_empty() {
            return None;
        }
        offset += line.len();
    }
    None
}

/// Collect chars until a delimiter, returning the collected string.
fn collect_until(chars: &mut impl Iterator<Item = char>, delimiter: char) -> String {
    let mut buf = String::new();
    for c in chars.by_ref() {
        if c == delimiter {
            break;
        }
        buf.push(c);
    }
    buf
}

/// Skip all chars until a delimiter (consuming the delimiter).
fn skip_until(chars: &mut impl Iterator<Item = char>, delimiter: char) {
    for c in chars.by_ref() {
        if c == delimiter {
            break;
        }
    }
}

/// Check if a char is markdown formatting that should be stripped.
fn is_markdown_formatting(ch: char) -> bool {
    matches!(ch, '*' | '_' | '`' | '~')
}

fn strip_markdown_chars(s: TextSlice<'_>) -> String {
    let value = s.as_str();
    let mut result = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '[' if chars.peek() == Some(&'[') => {
                process_wikilink(&mut chars, &mut result);
            }
            '[' => {
                process_markdown_link(&mut chars, &mut result);
            }
            c if is_markdown_formatting(c) => {}
            _ => result.push(ch),
        }
    }
    result
}

/// Process a wikilink `[[...]]` or `[[...|display]]`, extracting the display text.
fn process_wikilink(
    chars: &mut std::iter::Peekable<impl Iterator<Item = char>>,
    result: &mut String,
) {
    chars.next(); // consume second '['
    let inner = collect_wikilink_inner(chars);
    let display_text = extract_wikilink_display(&inner);
    result.push_str(display_text);
}

/// Extract display text from wikilink inner content.
/// Returns the part after '|' if present, otherwise the whole inner text.
fn extract_wikilink_display(inner: &str) -> &str {
    inner.find('|').map_or(inner, |idx| &inner[idx + 1..])
}

/// Process bracketed text.
/// Real markdown links `[text](url)` are unwrapped to `text`.
/// Plain bracketed text `[text]` is preserved verbatim.
fn process_markdown_link(
    chars: &mut std::iter::Peekable<impl Iterator<Item = char>>,
    result: &mut String,
) {
    let inner = collect_until(chars, ']');
    if chars.peek() == Some(&'(') {
        chars.next();
        skip_until(chars, ')');
        result.push_str(&inner);
        return;
    }

    result.push('[');
    result.push_str(&inner);
    result.push(']');
}

/// Collect chars inside a wikilink until `]]`, consuming both closing brackets.
fn collect_wikilink_inner(chars: &mut std::iter::Peekable<impl Iterator<Item = char>>) -> String {
    let mut buf = String::new();
    while let Some(c) = chars.next() {
        if c == ']' && chars.peek() == Some(&']') {
            chars.next();
            break;
        }
        buf.push(c);
    }
    buf
}

/// Check if a string contains a wikilink pattern `[[...]]`.
pub(super) fn contains_wikilink(s: &str) -> bool {
    s.contains("[[") && s.contains("]]")
}

/// Extract all outgoing wikilink targets from content.
/// Finds `[[target]]` and `[[target|display]]` patterns, returning just the target part.
/// Returns a sorted, deduplicated Vec of targets.
pub(super) fn extract_outgoing_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut search_from = 0;
    let bytes = content.as_bytes();
    while search_from + 3 < bytes.len() {
        let Some(start) = content[search_from..].find("[[") else {
            break;
        };
        let abs_start = search_from + start + 2;
        let Some(end) = content[abs_start..].find("]]") else {
            break;
        };
        let inner = &content[abs_start..abs_start + end];
        let target = match inner.find('|') {
            Some(idx) => &inner[..idx],
            None => inner,
        };
        if !target.is_empty() {
            links.push(target.to_string());
        }
        search_from = abs_start + end + 2;
    }
    links.sort();
    links.dedup();
    links
}

#[derive(Clone, Copy)]
struct MarkdownFence {
    marker: u8,
    length: usize,
}

fn next_markdown_fence(line: &str, active_fence: Option<MarkdownFence>) -> Option<MarkdownFence> {
    match active_fence {
        Some(fence) if !closes_fence(line, fence) => Some(fence),
        Some(_) => None,
        None => read_fence(line),
    }
}

/// Find the earliest valid follow-up in closed Activity line-record fences.
pub(super) fn extract_next_follow_up_at(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut earliest: Option<(DateTime<FixedOffset>, String)> = None;
    let mut active_fence = None;
    let mut in_activity = false;
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];

        if let Some(fence) = active_fence {
            if closes_fence(line, fence) {
                active_fence = None;
            }
            index += 1;
            continue;
        }

        if !in_activity {
            if is_activity_heading(line) {
                in_activity = true;
            } else if let Some(fence) = read_fence(line) {
                active_fence = Some(fence);
            }
            index += 1;
            continue;
        }

        if is_level_two_heading(line) {
            break;
        }

        let Some(fence) = read_fence(line) else {
            index += 1;
            continue;
        };

        if line != "```line-record" {
            active_fence = Some(fence);
            index += 1;
            continue;
        }

        let Some(closing_index) = find_closing_fence(&lines, index, fence) else {
            break;
        };
        keep_earliest_follow_up(
            &mut earliest,
            read_follow_up_at(&lines[index + 1..closing_index]),
        );
        index = closing_index + 1;
    }

    earliest.map(|(_, source)| source)
}

fn keep_earliest_follow_up(
    earliest: &mut Option<(DateTime<FixedOffset>, String)>,
    candidate: Option<(DateTime<FixedOffset>, String)>,
) {
    let Some((timestamp, source)) = candidate else {
        return;
    };
    if earliest
        .as_ref()
        .map_or(true, |(current, _)| timestamp < *current)
    {
        *earliest = Some((timestamp, source));
    }
}

fn is_activity_heading(line: &str) -> bool {
    let Some(trimmed) = strip_heading_indentation(line) else {
        return false;
    };
    let Some(rest) = trimmed.strip_prefix("##") else {
        return false;
    };
    if !rest.starts_with([' ', '\t']) {
        return false;
    }
    rest.trim_matches([' ', '\t'])
        .trim_end_matches('#')
        .trim_end_matches([' ', '\t'])
        .eq("Activity")
}

fn is_level_two_heading(line: &str) -> bool {
    let Some(trimmed) = strip_heading_indentation(line) else {
        return false;
    };
    let Some(rest) = trimmed.strip_prefix("##") else {
        return false;
    };
    !rest.starts_with('#') && (rest.is_empty() || rest.starts_with([' ', '\t']))
}

fn strip_heading_indentation(line: &str) -> Option<&str> {
    let indentation = line.bytes().take_while(|byte| *byte == b' ').count();
    (indentation <= 3).then(|| &line[indentation..])
}

fn read_fence(line: &str) -> Option<MarkdownFence> {
    let trimmed = line.trim_start();
    let marker = *trimmed.as_bytes().first()?;
    if marker != b'`' && marker != b'~' {
        return None;
    }
    let length = trimmed.bytes().take_while(|byte| *byte == marker).count();
    (length >= 3).then_some(MarkdownFence { marker, length })
}

fn closes_fence(line: &str, fence: MarkdownFence) -> bool {
    let trimmed = line.trim_start();
    let length = trimmed
        .bytes()
        .take_while(|byte| *byte == fence.marker)
        .count();
    length >= fence.length && trimmed[length..].trim().is_empty()
}

fn find_closing_fence(lines: &[&str], opening_index: usize, fence: MarkdownFence) -> Option<usize> {
    lines
        .iter()
        .enumerate()
        .skip(opening_index + 1)
        .find_map(|(index, line)| closes_fence(line, fence).then_some(index))
}

fn read_follow_up_at(lines: &[&str]) -> Option<(DateTime<FixedOffset>, String)> {
    for line in lines {
        if line.trim() == "---" {
            return None;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        if key.trim() != "follow_up_at" {
            continue;
        }
        let source = value.trim();
        let timestamp = DateTime::parse_from_rfc3339(source).ok()?;
        return Some((timestamp, source.to_string()));
    }
    None
}

#[cfg(test)]
#[path = "parsing_tests.rs"]
mod tests;

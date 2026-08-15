use super::*;

#[test]
fn indexes_the_earliest_valid_activity_follow_up() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "# Project\n\n## Activity\n\n```line-record\nid: later\nfollow_up_at: 2026-08-21T09:00:00-03:00\n---\nLater follow-up.\n```\n\n```line-record\nid: earlier\nfollow_up_at: 2026-08-20T09:00:00-03:00\n---\nEarlier follow-up.\n```\n",
    );

    assert_eq!(
        entry.next_follow_up_at.as_deref(),
        Some("2026-08-20T09:00:00-03:00")
    );
}

#[test]
fn ignores_activity_records_without_a_follow_up() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "## Activity\n\n```line-record\nid: complete\noccurred_at: 2026-08-19T09:00:00-03:00\n---\nCompleted update.\n```\n",
    );

    assert_eq!(entry.next_follow_up_at, None);
}

#[test]
fn ignores_invalid_activity_follow_up_values() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "## Activity\n\n```line-record\nid: invalid\nfollow_up_at: tomorrow morning\n---\nInvalid follow-up.\n```\n",
    );

    assert_eq!(entry.next_follow_up_at, None);
}

#[test]
fn ignores_activity_records_after_the_next_level_two_heading() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "## Activity\n\n```line-record\nid: in-activity\n---\nCompleted update.\n```\n\n## Decisions\n\n```line-record\nid: outside-activity\nfollow_up_at: 2026-08-20T09:00:00-03:00\n---\nMust not be indexed.\n```\n",
    );

    assert_eq!(entry.next_follow_up_at, None);
}

#[test]
fn ignores_unterminated_activity_record_fences() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "## Activity\n\n```line-record\nid: open\nfollow_up_at: 2026-08-20T09:00:00-03:00\n---\nStill open.\n",
    );

    assert_eq!(entry.next_follow_up_at, None);
}

#[test]
fn ignores_near_match_activity_record_openers() {
    let dir = TempDir::new().unwrap();

    for (file_name, opener, closer) in [
        ("tilde.md", "~~~line-record", "~~~"),
        ("longer.md", "````line-record", "````"),
        ("spaced.md", "``` line-record", "```"),
    ] {
        let content = format!(
            "## Activity\n\n{opener}\nid: near-match\nfollow_up_at: 2026-08-20T09:00:00-03:00\n---\nMust not be indexed.\n{closer}\n"
        );
        let entry = parse_test_entry(&dir, file_name, &content);

        assert_eq!(entry.next_follow_up_at, None, "{opener}");
    }
}

#[test]
fn indexes_overdue_activity_follow_ups() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "project.md",
        "## Activity\n\n```line-record\nid: overdue\nfollow_up_at: 2020-01-01T09:00:00-03:00\n---\nStill pending.\n```\n",
    );

    assert_eq!(
        entry.next_follow_up_at.as_deref(),
        Some("2020-01-01T09:00:00-03:00")
    );
}

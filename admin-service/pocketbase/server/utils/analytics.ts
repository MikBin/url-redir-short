export function aggregateLinkClicks(records: { link_id: string; click_count: number }[]): Record<string, number> {
  return records.reduce((acc, record) => {
    if (!acc[record.link_id]) {
      acc[record.link_id] = 0;
    }
    acc[record.link_id] += record.click_count;
    return acc;
  }, {} as Record<string, number>);
}

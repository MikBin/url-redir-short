export function aggregateLinkClicks(records: { link_id: string; click_count: number }[]): Record<string, number> {
  return records.reduce((acc, record) => {
    if (!acc[record.link_id]) {
      acc[record.link_id] = 0;
    }
    acc[record.link_id] += record.click_count;
    return acc;
  }, {} as Record<string, number>);
}

export function processAnalyticsEvents(events: any[], now: Date) {
  const linkCounts: Record<string, number> = {};
  const geoCounts: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {};
  const browserCounts: Record<string, number> = {};
  const hourlyTrendMap: Record<string, number> = {};

  const startOfNow = new Date(now.getTime());
  startOfNow.setUTCMinutes(0, 0, 0);

  // Initialize hourly trend with last 24 hours
  for (let i = 0; i < 24; i++) {
    const d = new Date(startOfNow.getTime() - i * 3600000);
    hourlyTrendMap[d.toISOString()] = 0;
  }

  for (const event of events) {
    if (event.path) {
      linkCounts[event.path] = (linkCounts[event.path] || 0) + 1;
    }
    if (event.country) {
      geoCounts[event.country] = (geoCounts[event.country] || 0) + 1;
    }
    if (event.device_type) {
      deviceCounts[event.device_type] = (deviceCounts[event.device_type] || 0) + 1;
    }
    if (event.browser) {
      browserCounts[event.browser] = (browserCounts[event.browser] || 0) + 1;
    }

    if (event.timestamp) {
      const eventTime = new Date(event.timestamp);
      eventTime.setUTCMinutes(0, 0, 0);
      const iso = eventTime.toISOString();
      if (hourlyTrendMap[iso] !== undefined) {
        hourlyTrendMap[iso]++;
      }
    }
  }

  const getTop10 = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  const topLinks = Object.entries(linkCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const hourlyTrend = Object.entries(hourlyTrendMap)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return {
    topLinks,
    geoDistribution: getTop10(geoCounts),
    deviceDistribution: getTop10(deviceCounts),
    browserDistribution: getTop10(browserCounts),
    hourlyTrend
  };
}

export const IPHONE_CHROME_LOCATION_PATH =
  'Settings > Privacy & Security > Location Services > Chrome > While Using + Precise Location'

export type LocationIssue = 'denied' | 'unavailable' | 'unsupported'

export function locationHelpText(issue: Exclude<LocationIssue, 'unsupported'>): string {
  const lead = issue === 'denied' ? 'Location is blocked for Chrome.' : 'Location is unavailable.'
  return `${lead} On iPhone: ${IPHONE_CHROME_LOCATION_PATH}. Then return to Pinfall and reload.`
}

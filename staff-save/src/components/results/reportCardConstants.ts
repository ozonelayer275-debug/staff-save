// Hardcoded to match the reference PDFs exactly — deliberately NOT wired to the
// app's mint `brand-*` theme tokens, so the whole-app retheme can never bleed
// into the printed document. Color-picked off the school's official template.
export const REPORT_TEAL = '#0e5c53'
export const REPORT_TEAL_DARK = '#0a4740'
export const REPORT_BORDER = '#1c1917'

export const AFFECTIVE_TRAITS_MAIN = [
  'Punctuality', 'Mental Alertness', 'Behavior', 'Reliability', 'Attentiveness',
  'Respect', 'Neatness', 'Politeness', 'Honesty',
  'Relationship with staff', 'Relationship with students', 'Attitude to school', 'Self-control',
] as const

export const AFFECTIVE_TRAITS_SECONDARY = ['Spirit of teamwork', 'Initiatives', 'Organizational ability'] as const

export const PSYCHOMOTOR_SKILLS = [
  'Handwriting', 'Reading', 'Verbal fluency/Diction', 'Musical Skills',
  'Creative arts', 'Physical education', 'General reasoning',
] as const

export const RATING_LEGEND: { rating: number; meaning: string }[] = [
  { rating: 5, meaning: 'Maintains an excellent degree of observation trait' },
  { rating: 4, meaning: 'Maintains high level of observation trait' },
  { rating: 3, meaning: 'Acceptable level of observation trait' },
  { rating: 2, meaning: 'Shows minimal level of observation trait' },
  { rating: 1, meaning: 'Has no regard for observation trait' },
]

export const TERM_ORDINALS: Record<'1' | '2' | '3', string> = { '1': 'FIRST', '2': 'SECOND', '3': 'THIRD' }

// The subject table always renders at a fixed row count with blank filler
// rows, matching the reference template's fixed table height regardless of
// how many subjects a class actually has.
export const SUBJECT_TABLE_MIN_ROWS = 14

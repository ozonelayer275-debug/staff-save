export default function StudentPhoto({ url, name, size = 'md' }: {
  url: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-24 h-24' : 'w-14 h-14'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-2xl' : 'text-sm'

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${dims} rounded-xl object-cover border border-stone-200 shrink-0 bg-stone-50`}
      />
    )
  }

  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`${dims} rounded-xl border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center shrink-0`}>
      <span className={`${textSize} font-semibold text-stone-400`}>{initials || '?'}</span>
    </div>
  )
}

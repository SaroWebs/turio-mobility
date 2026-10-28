

export type IconName =
  | 'arrow'
  | 'bell'
  | 'calendar'
  | 'car'
  | 'card'
  | 'check'
  | 'clock'
  | 'compass'
  | 'download'
  | 'filter'
  | 'gift'
  | 'grid'
  | 'help'
  | 'heart'
  | 'heart-outline'
  | 'home'
  | 'info'
  | 'list'
  | 'map'
  | 'menu'
  | 'search'
  | 'shield'
  | 'star'
  | 'tag'
  | 'ticket'
  | 'trash'
  | 'user'
  | 'users'
  | 'wallet'
  | 'x'

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string[]> = {
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
    calendar: ['M7 3v4', 'M17 3v4', 'M4 9h16', 'M5 5h14v16H5z'],
    car: ['M6 16h12l2-6H4z', 'M7 16v2', 'M17 16v2', 'M8 10l2-4h4l2 4'],
    card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
    check: ['M20 6L9 17l-5-5'],
    clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 6v6l4 2'],
    compass: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M15 9l-2 6-6 2 2-6z'],
    download: ['M12 16v-8', 'M8 10l4 4 4-4', 'M20 18H4v2h16z'],
    filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
    gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
    grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
    help: ['M12 18h.01', 'M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.9.7-1.6 1.2-1.6 2.6', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'],
    heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
    'heart-outline': ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
    home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M9 20v-6h6v6'],
    info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 16v-4', 'M12 8h.01'],
    list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
    map: ['M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3z', 'M9 3v15', 'M15 6v15'],
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
    shield: ['M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', 'M9 12l2 2 4-5'],
    star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9z'],
    tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
    ticket: ['M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z', 'M9 9v6', 'M15 9v6'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    user: ['M20 21a8 8 0 0 0-16 0', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    wallet: ['M3 7h16v12H3z', 'M16 11h5v4h-5z', 'M3 7l3-4h12'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
  }

  return (
    <svg aria-hidden="true" className="icon h-5 w-5 flex-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" fill="none" viewBox="0 0 24 24">
      {paths[name].map((path) => (
        <path d={path} key={path} pathLength="1" />
      ))}
    </svg>
  )
}

export function Header() {
  return (
    <header className="bg-gradient-to-r from-pink-200 via-purple-200 to-orange-200 border-b-4 border-black">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-center gap-3">
        <span className="text-3xl font-bold text-gray-900 tracking-tight">Lnk Lokr</span>
        <img
          src="/icons/lokr-extension-144.png"
          alt="Lokr"
          className="h-16 w-16 flex-shrink-0 object-contain drop-shadow-md"
        />
      </div>
    </header>
  )
}

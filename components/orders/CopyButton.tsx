"use client"

interface CopyButtonProps {
  value: string
}

export default function CopyButton({ value }: CopyButtonProps) {
  const handleCopy = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    alert("Key copied to clipboard!")
  }

  return (
    <button 
      onClick={handleCopy}
      className="bg-accent/10 hover:bg-accent text-accent-light hover:text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap active:scale-95"
    >
      Copy
    </button>
  )
}

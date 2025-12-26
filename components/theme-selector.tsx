"use client"

import { useState, useEffect } from "react"
import { Palette } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const themes = [
  { id: "dark", label: "Dark", color: "from-blue-500 to-cyan-500" },
  { id: "light", label: "Light", color: "from-gray-200 to-gray-100" },
  { id: "peach", label: "Peach", color: "from-orange-400 to-pink-300" },
  { id: "chocolate", label: "Chocolate", color: "from-amber-700 to-yellow-600" },
  { id: "winter", label: "Winter", color: "from-cyan-300 to-blue-400" },
  { id: "summer", label: "Summer", color: "from-yellow-300 to-green-400" },
]

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Get theme from localStorage or data attribute
    const savedTheme = localStorage.getItem("theme") || "dark"
    setCurrentTheme(savedTheme)
    document.documentElement.setAttribute("data-theme", savedTheme)
  }, [])

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme)
    localStorage.setItem("theme", theme)
    document.documentElement.setAttribute("data-theme", theme)
  }

  if (!mounted) return null

  return (
    <div className="flex items-center gap-2">
      <Palette className="h-4 w-4 text-muted-foreground" />
      <Select value={currentTheme} onValueChange={handleThemeChange}>
        <SelectTrigger className="w-32 bg-card/50 backdrop-blur border-primary/30 hover:border-primary/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card/95 backdrop-blur border-primary/30">
          {themes.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full bg-gradient-to-r ${theme.color}`} />
                {theme.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

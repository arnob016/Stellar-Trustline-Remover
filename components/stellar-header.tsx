"use client"

import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import ThemeSelector from "@/components/theme-selector"

interface StellarHeaderProps {
  onLogout?: () => void
}

export default function StellarHeader({ onLogout }: StellarHeaderProps) {
  return (
    <header className="glass border-b sticky top-0 z-50" style={{
      boxShadow: '0 8px 32px var(--primary) / 0.1'
    }}>
      <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-sm group transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
            <Wallet className="h-6 w-6 text-primary group-hover:text-accent transition-colors duration-300" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">Stellar Manager</h1>
            <p className="text-xs text-muted-foreground/80">Account Management Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeSelector />
          {onLogout && (
            <Button 
              variant="outline" 
              onClick={onLogout} 
              size="sm"
              className="border-primary/30 hover:border-primary/60 hover:bg-primary/10 transition-all duration-300 text-primary hover:text-primary"
            >
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

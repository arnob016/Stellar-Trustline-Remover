"use client"

import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"

interface NetworkSelectorProps {
  value: "public" | "testnet"
  onChange: (network: "public" | "testnet") => void
}

export default function NetworkSelector({ value, onChange }: NetworkSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Stellar Network
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={value === "public" ? "default" : "outline"}
          onClick={() => onChange("public")}
          className="w-full"
        >
          Public Network
        </Button>
        <Button
          variant={value === "testnet" ? "default" : "outline"}
          onClick={() => onChange("testnet")}
          className="w-full"
        >
          Testnet
        </Button>
      </div>
    </div>
  )
}

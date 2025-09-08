
import { Badge } from "@/components/ui/badge"
import React from "react"

const badges: string[] = [
    "Problem Solving",
    "Technology Help",
    "Creative Ideas",
    "Learning & Education",
]
interface BadgeProps {
    setSelectedPrompt: (badge: string) => void;
}
export const Badges: React.FC<BadgeProps> = ({ setSelectedPrompt }) => {

    return (
        <div className="flex flex-col gap-2 justify-center items-center">
            <h1 className="text-white font-medium text-xs">Quick Start:</h1>
            <div className="flex flex-wrap gap-1.5 justify-center">
                {
                    badges.map((badge, index) => (
                        <Badge 
                            key={index}
                            className="cursor-pointer bg-white/20 hover:bg-white/30 text-white border border-white/30 hover:border-white/50 transition-all duration-200 hover:scale-105 px-2 py-1 text-xs" 
                            onClick={() => setSelectedPrompt(badge)}
                        >
                            {badge}
                        </Badge>
                    ))
                }
            </div>
        </div>
    )
}
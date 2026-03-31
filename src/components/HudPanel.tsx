"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface HudPanelProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onClose?: () => void;
    className?: string;
    side?: 'left' | 'right';
    isCollapsible?: boolean;
    defaultExpanded?: boolean;
    headerExtra?: React.ReactNode;
    accentColor?: 'primary' | 'red' | 'blue' | 'white';
}

export function HudPanel({
    children,
    title,
    subtitle,
    icon,
    onClose,
    className = "",
    side = "left",
    isCollapsible = true,
    defaultExpanded = true,
    headerExtra,
    accentColor = "primary"
}: HudPanelProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const accentClasses = {
        primary: 'text-primary',
        red: 'text-red-400',
        blue: 'text-blue-400',
        white: 'text-white'
    };

    return (
        <div 
            className={`
                pointer-events-auto
                premium-glass glass-edge-highlight
                rounded-2xl shadow-2xl
                relative
                animate-in duration-500 overflow-hidden
                flex flex-col
                sticky top-4
                max-h-[calc(100vh-2rem)]
                ${side === 'left' ? 'slide-in-from-left-8' : 'slide-in-from-right-8'}
                ${isExpanded ? 'w-80' : 'w-14'}
                transition-all duration-300 ease-in-out
                ${className}
            `}
        >
            {/* Decorative Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b border-white/10 stealth-noir-glass ${!isExpanded ? 'flex-col gap-6 py-6' : 'gap-3'}`}>
                {isExpanded ? (
                    <>
                        <div className="flex items-center gap-3 overflow-hidden">
                            {icon && <div className="text-primary shrink-0">{icon}</div>}
                            <div className="min-w-0">
                                {title && (
                                    <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 truncate leading-none ${accentClasses[accentColor]}`}>
                                        {title}
                                    </h2>
                                ) || <div className="h-2" />}
                                {subtitle && (
                                    <div className="text-[10px] font-bold text-white/40 truncate leading-none">
                                        {subtitle}
                                    </div>
                                )}
                                {headerExtra}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {isCollapsible && (
                                <button 
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                                    title="Collapse Panel"
                                >
                                    {side === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                            )}
                            {onClose && (
                                <button 
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                                    title="Close Panel"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-4">
                            {icon && <div className="text-primary">{icon}</div>}
                            {title && (
                                <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">
                                    {title}
                                </div>
                            )}
                        </div>
                        {isCollapsible && (
                            <button 
                                onClick={() => setIsExpanded(true)}
                                className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors mt-4"
                                title="Expand Panel"
                            >
                                {side === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isExpanded ? 'p-4' : 'hidden'}`}>
                {children}
            </div>
        </div>
    );
}

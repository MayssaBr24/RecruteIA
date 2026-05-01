
import React, { useState, useEffect, useRef } from 'react';

interface VoiceMetrics {
    stress_level: 'low' | 'medium' | 'high';
    confidence_score: number;
    wpm: number; // words per minute
    fluency_score: number;
}

interface VoiceIndicatorProps {
    metrics: VoiceMetrics;
    isActive: boolean;
    autoHideDelay?: number;
}

const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
                                                           metrics,
                                                           isActive,
                                                           autoHideDelay = 8000
                                                       }) => {
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Show indicator when active
    useEffect(() => {
        if (isActive) {
            setVisible(true);

            // Auto-hide after delay
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setVisible(false);
            }, autoHideDelay);

            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }
    }, [isActive, autoHideDelay]);

    if (!visible) {
        return null;
    }

    // Calculate bar heights (0-100%)
    const stressBarHeight = metrics.stress_level === 'low' ? 20 :
        metrics.stress_level === 'medium' ? 50 : 80;

    const confidenceBarHeight = metrics.confidence_score * 100;
    const wpmBarHeight = Math.min(metrics.wpm / 2, 100); // Normalize to 0-100%
    const fluencyBarHeight = metrics.fluency_score * 100;

    return (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl px-6 py-4 border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-6">
                    {/* Voice bar visualization */}
                    <div className="flex items-end gap-1 h-12">
                        {/* Stress indicator */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col-reverse items-center h-8">
                                <div
                                    className={`w-3 rounded-t transition-all duration-500 ${
                                        metrics.stress_level === 'low' ? 'bg-green-500' :
                                            metrics.stress_level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ height: `${stressBarHeight}%`, minHeight: '4px' }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-500">STRESS</span>
                        </div>

                        {/* Confidence */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col-reverse items-center h-8">
                                <div
                                    className="w-3 bg-cyan-400 rounded-t transition-all duration-500"
                                    style={{ height: `${confidenceBarHeight}%`, minHeight: '4px' }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-500">CONF</span>
                        </div>

                        {/* WPM */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col-reverse items-center h-8">
                                <div
                                    className="w-3 bg-blue-400 rounded-t transition-all duration-500"
                                    style={{ height: `${wpmBarHeight}%`, minHeight: '4px' }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-500">WPM</span>
                        </div>

                        {/* Fluency */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col-reverse items-center h-8">
                                <div
                                    className="w-3 bg-purple-400 rounded-t transition-all duration-500"
                                    style={{ height: `${fluencyBarHeight}%`, minHeight: '4px' }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-500">FLU</span>
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                  metrics.stress_level === 'low' ? 'bg-green-500' :
                      metrics.stress_level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
                            <span className="text-gray-400">{metrics.wpm} mots/min</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span className="text-gray-400">Conf: {Math.round(metrics.confidence_score * 100)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Compact version - just a thin bar
export const CompactVoiceIndicator: React.FC<{ metrics: VoiceMetrics }> = ({ metrics }) => {
    const stressHeight = metrics.stress_level === 'low' ? 25 :
        metrics.stress_level === 'medium' ? 60 : 100;

    return (
        <div className="fixed top-16 left-4 z-50">
            <div
                className={`w-1 rounded-full transition-all duration-500 ${
                    metrics.stress_level === 'low' ? 'bg-green-500' :
                        metrics.stress_level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ height: `${stressHeight}%` }}
            />
        </div>
    );
};

// Waveform visualizer for audio input
export const AudioWaveform: React.FC<{ isRecording: boolean; intensity?: number }> = ({
                                                                                          isRecording,
                                                                                          intensity = 0.5
                                                                                      }) => {
    const bars = 5;
    const heights = [30, 60, 100, 60, 30].map(h => isRecording ? h * intensity : h * 0.2);

    return (
        <div className="flex items-center justify-center gap-1 h-6">
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                        isRecording ? 'bg-cyan-400' : 'bg-gray-600'
                    }`}
                    style={{
                        height: `${heights[i]}%`,
                        animationDelay: `${i * 50}ms`
                    }}
                />
            ))}
        </div>
    );
};

// Voice activity indicator ring
export const VoiceRing: React.FC<{ active: boolean; size?: number }> = ({
                                                                            active,
                                                                            size = 40
                                                                        }) => {
    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* Outer ring */}
            <div
                className={`absolute inset-0 rounded-full border-2 transition-all duration-300 ${
                    active ? 'border-cyan-400 animate-ping' : 'border-gray-600'
                }`}
                style={{ opacity: active ? 0.5 : 0.3 }}
            />
            {/* Inner circle */}
            <div
                className={`absolute inset-2 rounded-full transition-all duration-300 ${
                    active ? 'bg-cyan-500' : 'bg-gray-700'
                }`}
            />
            {/* Microphone icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                <svg
                    className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                </svg>
            </div>
        </div>
    );
};

export default VoiceIndicator;
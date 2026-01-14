# Design Guidelines: Real-Time Voice Transcription App

## Design Approach
**System-Based Approach** using Material Design principles for a clean, functional transcription interface. This utility-focused application prioritizes clarity, readability, and real-time data presentation over decorative elements.

## Layout Strategy
**Application Layout** - Not a marketing page. Single-page application interface with persistent controls and live transcript display.

**Spacing System**: Tailwind units of 2, 4, 6, and 8 (p-4, m-6, gap-8, etc.) for consistent rhythm.

**Container Structure**:
- Main app container: max-w-6xl centered
- Transcript area: Full width with comfortable padding (p-6 to p-8)
- Control panels: Compact spacing (p-4)

## Core Components

### Primary Interface
**Recording Control Center** (Top Section):
- Large, prominent record button (circular, 80-100px diameter)
- Connection status indicator with LiveKit session info
- Audio level visualizer (waveform or animated bars)
- Session timer display
- Settings/configuration icon button

**Transcript Display Area** (Main Section):
- Clean, scrollable transcript container with auto-scroll to latest
- Timestamps for each transcript segment (HH:MM:SS format)
- Speaker labels if multi-participant
- Confidence indicators (subtle, non-intrusive)
- Word-by-word highlighting as transcription occurs
- Export/copy transcript button (top-right of container)

**Configuration Panel** (Collapsible Side/Bottom):
- Language selection dropdown
- Model selection (Whisper variants)
- ASR sensitivity controls
- Audio input device selector

### Typography
**Font Stack**: 
- Interface: Inter or Roboto (Google Fonts)
- Transcript: JetBrains Mono or Roboto Mono for monospaced clarity

**Hierarchy**:
- Timer/Status: text-4xl font-bold
- Transcript text: text-lg leading-relaxed
- Timestamps: text-sm text-gray-500
- Controls/labels: text-base font-medium

### Component Details

**Record Button**:
- Circular with microphone icon
- Pulsing animation when recording
- Clear stopped/recording/processing states
- Backdrop blur effect: backdrop-blur-md bg-white/20

**Status Indicators**:
- Connected: Green dot + "Live" label
- Connecting: Yellow dot + "Connecting..."
- Error: Red dot + error message
- Positioned top-left of interface

**Transcript Cards**:
- Each transcript segment in subtle card (rounded-lg border)
- Timestamp left-aligned
- Speaker label (if applicable) in semibold
- Transcript text with comfortable line-height (1.6-1.8)
- Spacing between cards: space-y-4

**Audio Visualizer**:
- Horizontal bar visualization (5-7 bars)
- Animated height based on audio level
- Positioned near record button
- Subtle, non-distracting animation

## Layout Structure

```
┌─────────────────────────────────────────┐
│  Status: Live    ⚙️                     │
│                                          │
│         🎤 [Record Button]               │
│         [Audio Visualizer]               │
│         Timer: 00:02:45                  │
│                                          │
├─────────────────────────────────────────┤
│  Transcript                    [Copy]    │
│  ┌────────────────────────────────────┐ │
│  │ 00:00:12 - Speaker 1               │ │
│  │ Hello, this is a test of the...   │ │
│  │                                    │ │
│  │ 00:00:18 - Speaker 2               │ │
│  │ Yes, I can hear you clearly...    │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Interactions
- Single-click to start/stop recording
- Auto-scroll transcript to bottom
- Click timestamp to copy that segment
- Hover transcript segments for highlight
- Smooth fade-in for new transcript entries

## Images
**No hero image required**. This is a functional web application, not a marketing page. Focus entirely on the transcription interface and controls.

## Key Principles
- Maximum clarity for reading transcripts
- Instant visual feedback for recording state
- Minimal distractions from core functionality
- Professional, tool-like aesthetic
- Responsive design that works on tablets/laptops
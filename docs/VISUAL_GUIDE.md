# System Architecture

## 1. High-Level Architecture (WebSocket-Only)

![System Architecture](./images/system_architecture_flow.png)

## 2. iOS Approach Comparison

![iOS Approaches](./images/ios_approach_comparison.png)

### Approach Breakdown

| Approach | How it works | Pros | Cons |
|----------|--------------|------|------|
| **Multi-Codec** | Uses `audio/mp4` on iOS and `audio/webm` on Desktop | Simple, standard API | MP4 > WebM size |
| **Web Audio** | Captures raw PCM data via AudioContext | Total control, works eveywhere | High complexity, CPU heavy |
| **React Native** | Wraps native iOS audio APIs | Best performance | Not a web app anymore |
| **PWA** | Uses browser rules + Service Workers | Installable | Still tied to Safari limits |

## 3. Detailed Data Flow

![Data Flow](./images/data_flow_diagram.png)

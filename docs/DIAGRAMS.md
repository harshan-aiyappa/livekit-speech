# Visual Documentation Guide

**All diagrams use monochrome theme (Black/Grey/White on white background)**

---

## 📊 System Architecture

### 1a. Current Implementation (Hybrid)
![Current Hybrid Architecture](./images/current_hybrid_architecture.png)

### 1b. Recommended (WebSocket-Only)
![System Architecture](./images/system_architecture_flow.png)

### 1c. Alternative (LiveKit Agents)
![LiveKit Agents Architecture](./images/livekit_agents_architecture.png)

**Shows:**
- Comparison of architectural patterns
- Standard (LiveKit) vs Recommended (WebSocket) implementations
- Data flow differences

**Use Case:** Architecture decision reviews

---

## 🍎 iOS Compatibility

### 2a. iOS Solution Decision Tree

![iOS Solutions](./images/ios_solution_approaches.png)

**Shows:**
- Platform detection (Is iOS?)
- 4 solution approaches:
  1. Multi-Codec (Recommended ✓)
  2. Web Audio API (Advanced ⭐)
  3. React Native (⚠ Major Effort)
  4. PWA (Limited Fix)
- Desktop fallback (WebM/Opus)
- Final implementation step

### 2b. iOS Approach Technical Comparison
![iOS Approaches](./images/ios_approach_comparison.png)

**Shows:**
- Internal logic of all 4 approaches (Multi-Codec, Web Audio, React Native, PWA)
- Visual comparison of complexity vs functionality
- "Under the hood" data flow for each

**Use Case:** Choosing iOS compatibility approach

---

## ⏱️ Performance & Timing

### 3. Data Flow Timeline

![Data Flow Timeline](./images/data_flow_diagram.png)

**Shows:**
- 6 stages from User Speaks → Display Result
- Time annotations (T+0ms to T+5500ms)
- Processing details at each stage
- Total latency: 2-5 seconds ✓
- Real-time performance indicator

**Use Case:** Understanding performance and latency

---

## 🔄 Component Interaction

### 4. Frontend Component Flow

![Component Flow](./images/component_flow.png)

**Shows:**
- React component hierarchy
- State management (useLiveKit hook)
- User interactions (click record)
- Real-time updates (audio levels, transcripts)
- UI rendering flow

**Use Case:** Frontend development reference

---

## 🔌 WebSocket Protocol

### 5. WebSocket Message Flow

![WebSocket Protocol](./images/websocket_protocol.png)

**Shows:**
- Connection establishment
- Message types (audio_chunk, transcript, status, error)
- Data format (JSON structures)
- Error handling
- Connection lifecycle

**Use Case:** Backend integration and debugging

---

## 📱 Mobile Optimization

### 6. Responsive Design Breakpoints

![Responsive Design](./images/responsive_design.png)

**Shows:**
- Mobile (< 768px)
- Tablet (768px - 1024px)
- Desktop (> 1024px)
- Component adaptations
- Touch targets (44px minimum)

**Use Case:** UI/UX design decisions

---

## 🎯 User Journey

### 7. User Flow Diagram

![User Journey](./images/user_flow.png)

**Shows:**
- Entry point (Home page)
- Navigation (Test Mode selection)
- Permission request (microphone)
- Recording session
- View transcripts
- Export options

**Use Case:** UX planning and onboarding

---

## Images Summary

| # | Image | File | Purpose |
|---|-------|------|---------|
| 1 | System Architecture | `system_architecture_flow.png` | Complete system overview |
| 2 | iOS Solutions | `ios_solution_approaches.png` | iOS compatibility guide |
| 3 | Data Flow Timeline | `data_flow_diagram.png` | Performance & timing |
| 4 | Component Flow | `component_flow.png` | Frontend structure |
| 5 | WebSocket Protocol | `websocket_protocol.png` | Backend integration |
| 6 | Responsive Design | `responsive_design.png` | UI breakpoints |
| 7 | User Journey | `user_flow.png` | UX flow |

**Total:** 7 diagrams

---

## Using These Images

### In Documentation
```markdown
![Description](./images/filename.png)
```

### In Presentations
All images are high-resolution, white background, suitable for:
- Technical presentations
- Architecture reviews
- Developer onboarding
- Stakeholder demos

### Color Theme
- **Background:** White
- **Primary:** Black
- **Secondary:** Grey tones
- **Accent:** Minimal (checkmarks, warnings)

---

**Last Updated:** January 15, 2026  
**Image Format:** PNG  
**Resolution:** 1200x800px (standard)

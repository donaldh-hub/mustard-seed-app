## File Name: HeartbeatLogicRelay_System.js

### 1. Purpose
To serve as the *core interpretive framework* behind Jae’s reasoning, tone, and message delivery inside the Mustard Seed app.  
This relay ensures every reflection, reminder, or encouragement Jae gives is grounded in the **Five Heartbeats**—the essential rhythm of the Mustard Seed System.

It connects user data (progress, logs, emotions, interactions) to the right philosophical pulse, translating system data into human-sounding, emotionally intelligent feedback.

---

### 2. Core Components
1. **Heartbeat Engine:** 5 functional nodes (one per heartbeat) each storing key principles, voice tone cues, and contextual triggers.  
2. **Context Interpreter:** Reads user behavior, time of day, tone of chat, or reflection entries, then routes through the most relevant heartbeat.  
3. **Tone Regulator:** Keeps Jae’s voice grounded, empathetic, and encouraging—never coachy or drill-sergeant.  
4. **Message Composer:** Assembles natural-language responses pulling from the relevant heartbeat principles.  
5. **Feedback Sync:** Feeds user reactions and ongoing data back into the heartbeat engine for adaptive tone and focus.

---

### 3. Data Inputs
- User reflection text or chat entries  
- Daily progress data (steps, workouts, streaks)  
- Calendar context (gym day, rest day, assessment week)  
- App interactions (skipped day, achievement, low engagement)  
- Emotional keywords or self-ratings (if available)

---

### 4. Data Outputs
- Tone-aware reflections and encouragement from Jae  
- Timed notifications and gentle nudges tied to the active heartbeat  
- Adaptive micro-prompts (e.g., “What felt hardest today?” under Feedback & Adaptation)  
- Personalized reminders and affirmations

---

### 5. Logic & Function Flow
1. **Input Capture:** Detect user activity, reflection, or silence.  
2. **Interpretation:** The system reads context, maps to heartbeat most aligned with the current state.  
3. **Relay Activation:** Selected heartbeat sends relevant insight, quote, or reflection theme to Jae’s message composer.  
4. **Message Composition:** Natural-language template fills with user-specific variables.  
5. **Delivery:** Message sent to Jae’s chat or top-screen push (if opted in).  
6. **Feedback Loop:** User response or continued silence informs next heartbeat routing (e.g., silence after reflection → Small Steps).

---

### 6. Connectivity
- **ChatBotScreen.js** — delivers Jae’s responses  
- **ProgressScreen.js** — sends progress triggers  
- **CalendarScreen.js** — schedules contextual reminders  
- **SettingsScreen.js** — toggles heartbeat notification preferences  
- **AssessmentScreen.js** — recalibrates weight of each heartbeat per user profile

---

### 7. Agent Notes (Implementation)
- Each heartbeat node must have a short table of *principles, tone markers, and sample language*.  
- Store these in a structured JSON for easy expansion and localization later.  
- Include fallback messages if no data match is found (neutral encouragement).  
- Relay should be light—runs every time Jae prepares a message.  
- Prioritize *emotional accuracy* over frequency; less often but more meaningful beats.

---

### 8. Visual Layout (Text Sketch)
```
User Data → Context Interpreter → Heartbeat Engine
        → Message Composer → Chat Output (Jae)
                 ↑
            Feedback Sync

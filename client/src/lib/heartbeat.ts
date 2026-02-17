import { useStore } from './store';
import { HEARTBEAT_LIBRARY, HeartbeatModule } from './heartbeat-library';

// The "Five Heartbeats" Logic Framework
// 1. Acknowledge (Validate)
// 2. Reflect (Mirror back)
// 3. Connect (Link to goals/past)
// 4. Challenge (Gentle push)
// 5. Support (Affirmation)

// Helper to find the most relevant module
const analyzeIntent = (text: string): HeartbeatModule | null => {
  const lowerText = text.toLowerCase();
  let bestMatch: HeartbeatModule | null = null;
  let maxHits = 0;

  Object.values(HEARTBEAT_LIBRARY).forEach(module => {
    let hits = 0;
    module.keywords.forEach(kw => {
      if (lowerText.includes(kw)) hits++;
    });
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = module;
    }
  });

  return bestMatch;
};

export const processJaeResponse = async (userText: string) => {
  const store = useStore.getState();
  store.setTyping(true);

  // Simulate "thinking" delay
  const delay = 1000 + Math.random() * 1500;
  
  setTimeout(() => {
    let responseText = "";
    const lowerText = userText.toLowerCase();
    
    // 1. Analyze Intent & Select Heartbeat
    const module = analyzeIntent(userText);
    
    // 2. Construct Response using the Relay
    if (module) {
      // We found a relevant topic
      const pocketLine = module.pocketLines[Math.floor(Math.random() * module.pocketLines.length)];
      const tool = module.tools[Math.floor(Math.random() * module.tools.length)];
      
      // Jae Persona Construction:
      // Acknowledge -> Pocket Line (Insight) -> Tool/Prompt (Action)
      responseText = `I hear you. ${pocketLine} \n\nTry this: ${tool.action} (${tool.name})`;
      
    } else {
      // Fallback / General Logic (Existing)
      if (lowerText.includes('tired') || lowerText.includes('hard') || lowerText.includes('fail')) {
        responseText = "It sounds like things are heavy right now. (Acknowledge) Remember why you started this journey? (Connect) Let's just take one small step today. (Challenge)";
      } else if (lowerText.includes('done') || lowerText.includes('did it') || lowerText.includes('good')) {
        responseText = "That's wonderful! (Support) I'm adding this to your memory bank. (Reflect) How did it feel to accomplish that?";
        store.waterTree(); // Gamification hook
        store.addEntry(new Date().toISOString().split('T')[0], userText, 'happy');
      } else {
        responseText = "I'm listening. Tell me more about that.";
      }
    }

    store.addMessage({
      text: responseText,
      sender: 'jae',
    });
    store.setTyping(false);
  }, delay);
};

// Export for UI to use suggestions
export const getSuggestions = (): string[] => {
  // Return random prompts from across the library to guide the user
  const allPrompts = Object.values(HEARTBEAT_LIBRARY).flatMap(m => m.prompts);
  // Shuffle and pick 3
  return allPrompts.sort(() => 0.5 - Math.random()).slice(0, 3);
};

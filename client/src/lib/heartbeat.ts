import { useStore } from './store';

// The "Five Heartbeats" Logic Framework
// 1. Acknowledge (Validate)
// 2. Reflect (Mirror back)
// 3. Connect (Link to goals/past)
// 4. Challenge (Gentle push)
// 5. Support (Affirmation)

const JAE_RESPONSES = {
  assessment: [
    "I hear you. It takes courage to admit that.",
    "That makes sense. We can work on that together.",
    "Noted. I'll keep that in mind as we journey forward."
  ],
  checkin: [
    "How are you feeling about your progress today?",
    "Remember that big goal we talked about? How does today fit into that?",
    "It's okay to have off days. What's one small thing you can do right now?"
  ],
  celebration: [
    "Look at you go! Adding some water to your tree.",
    "That's the spirit. Your tree is loving this energy.",
    "Progress is progress, no matter how small."
  ]
};

export const processJaeResponse = async (userText: string) => {
  const store = useStore.getState();
  store.setTyping(true);

  // Simulate "thinking" and "typing" delay based on the Five Heartbeats processing
  const delay = 1000 + Math.random() * 1500;
  
  setTimeout(() => {
    let responseText = "";
    
    // Simple keyword matching to simulate the AI persona
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('tired') || lowerText.includes('hard') || lowerText.includes('fail')) {
      responseText = "It sounds like things are heavy right now. (Acknowledge) Remember why you started this journey? (Connect) Let's just take one small step today. (Challenge)";
    } else if (lowerText.includes('done') || lowerText.includes('did it') || lowerText.includes('good')) {
      responseText = "That's wonderful! (Support) I'm adding this to your memory bank. (Reflect) How did it feel to accomplish that?";
      store.waterTree(); // Gamification hook
      store.addEntry(new Date().toISOString().split('T')[0], userText, 'happy');
    } else {
      responseText = "I'm listening. Tell me more about that.";
    }

    store.addMessage({
      text: responseText,
      sender: 'jae',
    });
    store.setTyping(false);
  }, delay);
};

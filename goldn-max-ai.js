const chat = document.getElementById("chat-window");
const input = document.getElementById("user-input");

const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");

sendBtn.onclick = sendMessage;
voiceBtn.onclick = startVoiceInput;
input.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

// OPTIONAL: add your OpenAI key for online mode
const OPENAI_KEY = ""; // <-- put your key here if you want online GPT

function addMessage(text, sender) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (sender === "user" ? "user-msg" : "ai-msg");

    const main = document.createElement("div");
    main.textContent = text;
    wrap.appendChild(main);

    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    addMessage(msg, "user");

    const lower = msg.toLowerCase();

    // Memory commands
    if (lower.startsWith("remember ")) {
        const fact = msg.slice(9);
        GoldnMemory.remember(fact);
        const reply = "Got it. I’ve stored that in your memory vault.";
        addMessage(reply, "ai");
        speak(reply);
        return;
    }
    if (lower === "show memory" || lower === "recall memory" || lower === "what do you remember") {
        const mem = GoldnMemory.recall();
        const reply = "Here’s what I remember so far:\n- " + mem;
        addMessage(reply, "ai");
        speak(reply);
        return;
    }

    const needsOnline =
        OPENAI_KEY &&
        (lower.includes("news") ||
         lower.includes("today") ||
         lower.includes("price of") ||
         lower.includes("weather"));

    if (needsOnline) {
        const reply = await onlineGPT(msg);
        addMessage(reply, "ai");
        speak(reply);
    } else {
        const reply = await offlineBrain(msg);
        addMessage(reply, "ai");
        speak(reply);
    }
}

async function offlineBrain(prompt) {
    const memory = GoldnMemory.recall();
    return `
[Goldn MAX Offline Mode]

Stored memory:
- ${memory}

User said: "${prompt}"

Reasoning:
1. I interpret your question.
2. I compare it with your known preferences.
3. I answer calmly in a Jarvis-style tone.

(Offline mode cannot access the internet.)
    `.trim();
}

async function onlineGPT(prompt) {
    if (!OPENAI_KEY) {
        return "Online mode requires an OpenAI API key.";
    }

    const memory = GoldnMemory.recall();

    const body = {
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `
You are Goldn MAX AI, a calm male Jarvis-style assistant.
USER MEMORY:
- ${memory}
                `
            },
            { role: "user", content: prompt }
        ]
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + OPENAI_KEY
        },
        body: JSON.stringify(body)
    });

    if (!r.ok) return "Online mode error: " + r.status;

    const j = await r.json();
    return j.choices[0].message.content.trim();
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice input not supported in this browser.");
        return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.onresult = function (e) {
        input.value = e.results[0][0].transcript;
        sendMessage();
    };
    rec.start();
}

function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        /alex|daniel|male|english/i.test(v.name + " " + v.lang)
    );
    if (preferred) msg.voice = preferred;
    msg.rate = 1.0;
    msg.pitch = 1.0;
    window.speechSynthesis.speak(msg);
}

window.speechSynthesis.onvoiceschanged = () => {};

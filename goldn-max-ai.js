// goldn-max-ai.js (ES module)

// Import WebLLM Qwen2 0.5B engine
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const chatEl = document.getElementById("chat-window");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const volumeSlider = document.getElementById("volume-slider");
const muteBtn = document.getElementById("mute-btn");
const stopBtn = document.getElementById("stop-voice-btn");
const statusBar = document.getElementById("status-bar");

// ---------------- LLM ENGINE (Qwen2 0.5B in-browser) ----------------

const MODEL_NAME = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

let engine = null;
let engineReady = false;
let generating = false;

const messages = [
    { role: "system", content: "You are Goldn MAX, a calm, helpful Jarvis-style assistant." }
];

async function initEngine() {
    try {
        statusBar.textContent = "Downloading Qwen2 0.5B model (first time can take a few minutes)…";

        engine = await CreateMLCEngine(MODEL_NAME, {
            initProgressCallback: (p) => {
                const pct = Math.round((p.progress || 0) * 100);
                statusBar.textContent = (p.text || "Loading…") + " " + pct + "%";
            }
        });

        engineReady = true;
        statusBar.textContent = "Model ready ✔ (Qwen2 0.5B running on this device)";
    } catch (err) {
        console.error(err);
        engineReady = false;
        statusBar.textContent = "LLM load failed; using offline template replies.";
    }
}

initEngine();

// ---------------- CHAT UI HELPERS ----------------

function addMessage(text, sender) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (sender === "user" ? "user-msg" : "ai-msg");
    const main = document.createElement("div");
    main.textContent = text;
    wrap.appendChild(main);
    chatEl.appendChild(wrap);
    chatEl.scrollTop = chatEl.scrollHeight;
}

// ---------------- VOICE OUTPUT CONTROL ----------------

let isMuted = false;
let currentUtterance = null;

function speak(text) {
    if (!("speechSynthesis" in window) || isMuted) return;

    if (currentUtterance) {
        window.speechSynthesis.cancel();
    }

    const u = new SpeechSynthesisUtterance(text);
    currentUtterance = u;

    const vol = parseFloat(volumeSlider.value || "1");
    u.volume = vol;
    u.rate = 1.05;
    u.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        /alex|daniel|male|english/i.test((v.name || "") + " " + (v.lang || ""))
    );
    if (preferred) u.voice = preferred;

    window.speechSynthesis.speak(u);
}

window.speechSynthesis.onvoiceschanged = () => {};

// volume slider live updates current utterance
volumeSlider.addEventListener("input", () => {
    if (currentUtterance) {
        currentUtterance.volume = parseFloat(volumeSlider.value || "1");
    }
});

muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "🔇" : "🔊";
    if (isMuted) {
        window.speechSynthesis.cancel();
    }
});

stopBtn.addEventListener("click", () => {
    window.speechSynthesis.cancel();
});

// ---------------- VOICE INPUT ----------------

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice input not supported in this browser.");
        return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.onresult = function (e) {
        inputEl.value = e.results[0][0].transcript;
        sendMessage();
    };
    rec.start();
}

// ---------------- OFFLINE FALLBACK BRAIN ----------------

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

(Offline template mode – local LLM unavailable.)
`.trim();
}

// ---------------- WEBLLM CALL ----------------

async function callLocalLLM(prompt) {
    if (!engine || !engineReady) {
        return offlineBrain(prompt);
    }

    messages.push({ role: "user", content: prompt });

    let reply = "";
    try {
        const stream = await engine.chat.completions.create({
            messages,
            temperature: 0.7,
            stream: true
        });

        const aiWrap = document.createElement("div");
        aiWrap.className = "msg ai-msg";
        const main = document.createElement("div");
        aiWrap.appendChild(main);
        chatEl.appendChild(aiWrap);
        chatEl.scrollTop = chatEl.scrollHeight;

        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (delta) {
                reply += delta;
                main.textContent = reply;
                chatEl.scrollTop = chatEl.scrollHeight;
            }
        }

        messages.push({ role: "assistant", content: reply });
        return reply || "(no response)";
    } catch (err) {
        console.error(err);
        return offlineBrain(prompt);
    }
}

// ---------------- MESSAGE SEND ----------------

async function sendMessage() {
    const msg = inputEl.value.trim();
    if (!msg || generating) return;
    inputEl.value = "";

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

    generating = true;
    sendBtn.disabled = true;

    let reply;
    if (engineReady) {
        reply = await callLocalLLM(msg);
        // callLocalLLM already added streaming text; no need to add again
        speak(reply);
    } else {
        reply = await offlineBrain(msg);
        addMessage(reply, "ai");
        speak(reply);
    }

    generating = false;
    sendBtn.disabled = false;
}

sendBtn.onclick = sendMessage;
voiceBtn.onclick = startVoiceInput;
inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

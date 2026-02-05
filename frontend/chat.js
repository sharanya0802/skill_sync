console.log("chat.js loaded");
// ---------------- CONFIG ----------------

// Import Supabase client
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------- DOM ----------------
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const userDisplay = document.getElementById("userDisplay");
const backBtn = document.getElementById("backBtn");

// ---------------- SESSION ----------------
const username = localStorage.getItem("username");

const urlParams = new URLSearchParams(window.location.search);
const chatWith = urlParams.get("chatWith");

if (!username || !chatWith) {
    alert("Session expired or chat user missing");
    window.location.href = "dashboard.html";
}

userDisplay.innerText = `Chatting with: ${chatWith}`;

// Back button
backBtn.onclick = () => {
    window.location.href = "dashboard.html";
};

// ---------------- SEND MESSAGE ----------------
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .insert([{ 
                from_user: username, 
                to_user: chatWith, 
                message 
            }]);

        if (error) {
            console.error("Insert failed:", error);
            alert("Failed to send message");
            return;
        }

        chatInput.value = "";
    } catch (err) {
        console.error("Error sending message:", err);
    }
}

// ---------------- LOAD MESSAGES ----------------
async function loadMessages() {
    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .select("*")
            .or(`and(from_user.eq.${username},to_user.eq.${chatWith}),and(from_user.eq.${chatWith},to_user.eq.${username})`)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Load messages error:", error);
            return;
        }

        chatBox.innerHTML = "";
        data.forEach(m => {
            const isMe = m.from_user === username;
            const text = isMe ? `You: ${m.message}` : `${chatWith}: ${m.message}`;
            appendMessage(text, isMe);
        });
    } catch (err) {
        console.error("Error loading messages:", err);
    }
}

// ---------------- APPEND MESSAGE ----------------
function appendMessage(text, isMe = false) {
    const div = document.createElement("div");
    div.textContent = text;
    div.style.marginBottom = "8px";
    div.style.padding = "8px";
    div.style.borderRadius = "5px";
    div.style.backgroundColor = isMe ? "#e3f2fd" : "#f5f5f5";
    div.style.textAlign = isMe ? "right" : "left";
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------------- REAL-TIME ----------------
const channel = supabaseClient
    .channel("messages-channel")
    .on(
        "postgres_changes",
        { 
            event: "INSERT", 
            schema: "public", 
            table: "messages" 
        },
        (payload) => {
            const m = payload.new;
            
            // Only show messages between current user and chat partner
            if ((m.from_user === username && m.to_user === chatWith) || 
                (m.from_user === chatWith && m.to_user === username)) {
                const isMe = m.from_user === username;
                const text = isMe ? `You: ${m.message}` : `${chatWith}: ${m.message}`;
                appendMessage(text, isMe);
            }
        }
    )
    .subscribe((status) => {
        console.log("Subscription status:", status);
    });

// Initial load
loadMessages();

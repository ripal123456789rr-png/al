const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const micOrSendBtn = document.getElementById("micOrSendBtn");
const micOrSendIcon = document.getElementById("micOrSendIcon");
const aiStatus = document.getElementById("aiStatus");
const typingIndicator = document.getElementById("typingIndicator");
const clearChatBtn = document.getElementById("clearChatBtn");

const normalInputContainer = document.getElementById("normalInputContainer");
const recordingContainer = document.getElementById("recordingContainer");
const cancelRecBtn = document.getElementById("cancelRecBtn");
const sendRecBtn = document.getElementById("sendRecBtn");
const recTimer = document.getElementById("recTimer");
const toast = document.getElementById("toast");

let conversationHistory = JSON.parse(localStorage.getItem("hinokawa_history")) || [];
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;
let activeAudio = null;
let activePlayBtn = null;

window.addEventListener("DOMContentLoaded", () => {
  if (conversationHistory.length === 0) {
    const welcomeText = "Halo! Aku HINOKAWA AI. Ada yang bisa kubantu hari ini? Kamu bisa mengetik pesan atau kirim voice note langsung ke aku ya 😊";
    appendTextMessage("incoming", welcomeText, getCurrentTime(), false);
  } else {
    conversationHistory.forEach((msg) => {
      if (msg.type === "vn" && msg.audioUrl) {
        appendVoiceNoteMessage(msg.sender, msg.audioUrl, msg.duration || "0:05", msg.text, msg.time);
      } else {
        appendTextMessage(msg.sender, msg.text, msg.time, false);
      }
    });
  }
  scrollToBottom();
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 110)}px`;

  if (messageInput.value.trim().length > 0) {
    micOrSendIcon.className = "fa-solid fa-paper-plane";
    micOrSendBtn.title = "Kirim pesan";
  } else {
    micOrSendIcon.className = "fa-solid fa-microphone";
    micOrSendBtn.title = "Rekam suara";
  }
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (messageInput.value.trim().length > 0) {
      handleSendText();
    }
  }
});

micOrSendBtn.addEventListener("click", () => {
  const text = messageInput.value.trim();
  if (text.length > 0) {
    handleSendText();
  } else {
    startVoiceRecording();
  }
});

clearChatBtn.addEventListener("click", () => {
  if (confirm("Hapus semua riwayat percakapan dengan HINOKAWA AI?")) {
    conversationHistory = [];
    localStorage.removeItem("hinokawa_history");
    chatArea.innerHTML = `<div class="date-divider"><span>Hari ini</span></div>`;
    const welcomeText = "Percakapan telah dibersihkan. Silakan mulai obrolan baru dengan HINOKAWA AI!";
    appendTextMessage("incoming", welcomeText, getCurrentTime(), false);
    showToast("Riwayat percakapan dihapus");
  }
});

async function handleSendText() {
  const text = messageInput.value.trim();
  if (!text) return;

  const time = getCurrentTime();
  messageInput.value = "";
  messageInput.style.height = "auto";
  micOrSendIcon.className = "fa-solid fa-microphone";

  appendTextMessage("outgoing", text, time, true);
  saveHistory({ sender: "outgoing", type: "text", text, time });

  setAIState("mengetik...");

  try {
    const reply = await fetchAIChatReply(text);
    const replyTime = getCurrentTime();
    appendTextMessage("incoming", reply, replyTime, true);
    saveHistory({ sender: "incoming", type: "text", text: reply, time: replyTime });
  } catch (err) {
    console.error(err);
    appendTextMessage("incoming", "Maaf, koneksi ke server HINOKAWA AI sedang bermasalah. Coba lagi sebentar ya.", getCurrentTime(), false);
  } finally {
    setAIState("online");
  }
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();
    recordingSeconds = 0;
    recTimer.textContent = "0:00";

    normalInputContainer.classList.add("hidden");
    recordingContainer.classList.remove("hidden");

    recordingInterval = setInterval(() => {
      recordingSeconds++;
      recTimer.textContent = formatDuration(recordingSeconds);
    }, 1000);
  } catch (err) {
    console.error("Mic error:", err);
    showToast("Izin mikrofon ditolak atau tidak tersedia.");
  }
}

cancelRecBtn.addEventListener("click", () => {
  stopRecordingTracks();
  recordingContainer.classList.add("hidden");
  normalInputContainer.classList.remove("hidden");
  showToast("Rekaman dibatalkan");
});

sendRecBtn.addEventListener("click", () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return;

  const finalDuration = formatDuration(Math.max(recordingSeconds, 1));

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    const userAudioUrl = URL.createObjectURL(audioBlob);
    const time = getCurrentTime();

    const vnDom = appendVoiceNoteMessage("outgoing", userAudioUrl, finalDuration, "Mengubah suara ke teks...", time);

    setAIState("merekam suara...");

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const transcribeRes = await fetch("/.netlify/functions/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64Audio, mimeType: audioBlob.type })
      });

      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || "Gagal transkripsi suara");

      const userSpokenText = transcribeData.text;
      const transcriptEl = vnDom.querySelector(".vn-transcript");
      if (transcriptEl) transcriptEl.textContent = `"${userSpokenText}"`;

      saveHistory({ sender: "outgoing", type: "text", text: userSpokenText, time });

      const aiReplyText = await fetchAIChatReply(userSpokenText);

      const speechRes = await fetch("/.netlify/functions/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiReplyText })
      });

      const speechData = await speechRes.json();
      if (!speechRes.ok) throw new Error(speechData.error || "Gagal membuat suara AI");

      const aiAudioBlob = base64ToBlob(speechData.audioBase64, "audio/mpeg");
      const aiAudioUrl = URL.createObjectURL(aiAudioBlob);
      const replyTime = getCurrentTime();

      const tempAudio = new Audio(aiAudioUrl);
      tempAudio.addEventListener("loadedmetadata", () => {
        const aiDuration = formatDuration(Math.round(tempAudio.duration || 3));
        appendVoiceNoteMessage("incoming", aiAudioUrl, aiDuration, aiReplyText, replyTime);
        saveHistory({ sender: "incoming", type: "text", text: aiReplyText, time: replyTime });
        setAIState("online");
      });
    } catch (err) {
      console.error(err);
      appendTextMessage("incoming", `Maaf, gagal memproses voice note: ${err.message}`, getCurrentTime(), false);
      setAIState("online");
    }
  };

  stopRecordingTracks();
  recordingContainer.classList.add("hidden");
  normalInputContainer.classList.remove("hidden");
});

function stopRecordingTracks() {
  clearInterval(recordingInterval);
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (mediaRecorder && mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }
}

async function fetchAIChatReply(userMessage) {
  const formattedMessages = conversationHistory.slice(-12).map((item) => ({
    role: item.sender === "outgoing" ? "user" : "assistant",
    content: item.text
  }));

  if (
    formattedMessages.length === 0 ||
    formattedMessages[formattedMessages.length - 1].content !== userMessage
  ) {
    formattedMessages.push({ role: "user", content: userMessage });
  }

  const response = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: formattedMessages })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Terjadi kesalahan pada server AI");
  }
  return data.reply;
}

function appendTextMessage(sender, text, time, showTicks = true) {
  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const ticksHtml =
    sender === "outgoing" && showTicks
      ? `<span class="ticks"><i class="fa-solid fa-check-double"></i></span>`
      : "";

  const labelHtml =
    sender === "incoming" ? `<div class="sender-label">HINOKAWA AI</div>` : "";

  row.innerHTML = `
    <div class="bubble">
      ${labelHtml}
      <div class="message-text">${escapeHtml(text)}</div>
      <div class="message-meta">
        <span>${time}</span>
        ${ticksHtml}
      </div>
    </div>
  `;

  chatArea.appendChild(row);
  scrollToBottom();
  return row;
}

function appendVoiceNoteMessage(sender, audioUrl, durationStr, transcriptText, time) {
  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const fileCode = `AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-AI`;
  const ticksHtml =
    sender === "outgoing"
      ? `<span class="ticks"><i class="fa-solid fa-check-double"></i></span>`
      : "";

  const senderTitle = sender === "outgoing" ? "Anda" : "HINOKAWA AI";

  row.innerHTML = `
    <div class="bubble vn-bubble">
      <div class="sender-label" style="color: ${sender === "outgoing" ? "#8be9fd" : "#53bdeb"}">${senderTitle}</div>
      <div class="vn-player">
        <div class="vn-badge">
          <i class="fa-solid fa-headphones"></i>
          <span class="vn-duration-badge">${durationStr}</span>
        </div>
        <button class="vn-play-btn" aria-label="Putar Voice Note">
          <i class="fa-solid fa-play"></i>
        </button>
        <div class="vn-track-wrapper">
          <input type="range" class="vn-slider" min="0" max="100" value="0" />
          <div class="vn-sub-info">
            <span>${fileCode}</span>
            <span>${time} ${ticksHtml}</span>
          </div>
        </div>
      </div>
      ${transcriptText ? `<div class="vn-transcript">${escapeHtml(transcriptText)}</div>` : ""}
    </div>
  `;

  chatArea.appendChild(row);
  scrollToBottom();

  const audio = new Audio(audioUrl);
  const playBtn = row.querySelector(".vn-play-btn");
  const playIcon = playBtn.querySelector("i");
  const slider = row.querySelector(".vn-slider");
  const durationBadge = row.querySelector(".vn-duration-badge");

  playBtn.addEventListener("click", () => {
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
      if (activePlayBtn) activePlayBtn.className = "fa-solid fa-play";
    }

    if (audio.paused) {
      audio.play();
      playIcon.className = "fa-solid fa-pause";
      activeAudio = audio;
      activePlayBtn = playIcon;
    } else {
      audio.pause();
      playIcon.className = "fa-solid fa-play";
    }
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      slider.value = (audio.currentTime / audio.duration) * 100;
      durationBadge.textContent = formatDuration(Math.floor(audio.currentTime));
    }
  });

  audio.addEventListener("ended", () => {
    playIcon.className = "fa-solid fa-play";
    slider.value = 0;
    durationBadge.textContent = durationStr;
  });

  slider.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (slider.value / 100) * audio.duration;
    }
  });

  return row;
}

function setAIState(statusText) {
  aiStatus.textContent = statusText;
  if (statusText !== "online") {
    aiStatus.classList.add("typing");
    typingIndicator.classList.remove("hidden");
  } else {
    aiStatus.classList.remove("typing");
    typingIndicator.classList.add("hidden");
  }
  scrollToBottom();
}

function saveHistory(entry) {
  conversationHistory.push(entry);
  if (conversationHistory.length > 40) {
    conversationHistory = conversationHistory.slice(-40);
  }
  localStorage.setItem("hinokawa_history", JSON.stringify(conversationHistory));
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2600);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

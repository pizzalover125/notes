let currentFiles = [];
let flashcardsData = [];
let currentCardIndex = 0;
let quizData = [];
let quizScore = { correct: 0, total: 0 };
let currentQuizIndex = 0;
let questionAnswered = false;
let chatHistory = [];
let notesContent = "";
let selectedModel = "google/gemini-3-flash-preview";
const STUDY_STATE_KEY = "notesStudyState";

const COLOR_SCHEMES = [
  {
    name: "Midnight",
    bg: "#000000",
    fg: "#ffffff",
    accent: "#333333",
    muted: "#888888",
    highlight: "#e8a735",
  },
  {
    name: "Slate",
    bg: "#1a1a2e",
    fg: "#e0e0e0",
    accent: "#16213e",
    muted: "#7f8c8d",
    highlight: "#5b8fb9",
  },
  {
    name: "Forest",
    bg: "#0a1a0a",
    fg: "#c8e6c9",
    accent: "#1b3a1b",
    muted: "#6b8f6b",
    highlight: "#4caf50",
  },
  {
    name: "Ocean",
    bg: "#0a0f1a",
    fg: "#b3d9ff",
    accent: "#112240",
    muted: "#5a87b0",
    highlight: "#2196f3",
  },
  {
    name: "Ember",
    bg: "#1a0a0a",
    fg: "#ffccbc",
    accent: "#3e1616",
    muted: "#b06050",
    highlight: "#e65100",
  },
  {
    name: "Violet",
    bg: "#12061f",
    fg: "#d1c4e9",
    accent: "#1f0a33",
    muted: "#8068a0",
    highlight: "#9c27b0",
  },
  {
    name: "Sand",
    bg: "#1a1710",
    fg: "#e8dcc8",
    accent: "#2e2818",
    muted: "#9a8a6a",
    highlight: "#c9a84c",
  },
  {
    name: "Frost",
    bg: "#f0f0f0",
    fg: "#111111",
    accent: "#d0d0d0",
    muted: "#777777",
    highlight: "#f5c842",
  },
];

function getSelectedModel() {
  return (
    localStorage.getItem("selectedModel") || "google/gemini-3-flash-preview"
  );
}

function applyColorScheme(scheme) {
  document.documentElement.style.setProperty("--bg", scheme.bg);
  document.documentElement.style.setProperty("--fg", scheme.fg);
  document.documentElement.style.setProperty("--accent", scheme.accent);
  document.documentElement.style.setProperty("--muted", scheme.muted);
  document.documentElement.style.setProperty("--highlight", scheme.highlight);
  localStorage.setItem("colorScheme", scheme.name);
  const fav = document.getElementById("favicon");
  if (fav) {
    const color = scheme.highlight.replace("#", "%23");
    fav.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='${color}'/></svg>`;
  }
}

function initSettings() {
  selectedModel = getSelectedModel();

  const savedScheme = localStorage.getItem("colorScheme");
  const scheme =
    COLOR_SCHEMES.find((s) => s.name === savedScheme) || COLOR_SCHEMES[0];
  applyColorScheme(scheme);

  const grid = document.getElementById("colorSchemeOptions");
  COLOR_SCHEMES.forEach((s) => {
    const swatch = document.createElement("button");
    swatch.className =
      "color-swatch" + (s.name === scheme.name ? " active" : "");
    swatch.title = s.name;
    swatch.style.background = s.bg;
    swatch.style.border = `2px solid ${s.fg}`;
    swatch.innerHTML = `<span style="color:${s.fg}">${s.name}</span>`;
    swatch.addEventListener("click", () => {
      applyColorScheme(s);
      grid
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("active"));
      swatch.classList.add("active");
    });
    grid.appendChild(swatch);
  });

  fetch("/models")
    .then((r) => r.json())
    .then((data) => {
      const select = document.getElementById("modelSelect");
      data.models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === selectedModel) opt.selected = true;
        select.appendChild(opt);
      });
    })
    .catch(() => {
      const select = document.getElementById("modelSelect");
      const opt = document.createElement("option");
      opt.value = "google/gemini-2.5-flash";
      opt.textContent = "Gemini 2.5 Flash";
      opt.selected = true;
      select.appendChild(opt);
    });

  document.getElementById("modelSelect").addEventListener("change", (e) => {
    selectedModel = e.target.value;
    localStorage.setItem("selectedModel", selectedModel);
  });

  document.getElementById("settingsToggle").addEventListener("click", () => {
    const panel = document.getElementById("settingsPanel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  document.getElementById("settingsClose").addEventListener("click", () => {
    document.getElementById("settingsPanel").style.display = "none";
  });
}

initSettings();

const dropZone = document.getElementById("dropZone");
const pdfInput = document.getElementById("pdfFile");

function updateDropZoneText(files) {
  const text = dropZone.querySelector(".drop-zone-text");
  if (!files.length) {
    text.textContent = "drag & drop your PDFs here";
    dropZone.classList.remove("has-file");
    return;
  }

  if (files.length === 1) {
    text.textContent = files[0].name;
  } else {
    text.textContent = `${files.length} PDFs selected`;
  }
  dropZone.classList.add("has-file");
}

function resetGeneratedContent() {
  flashcardsData = [];
  currentCardIndex = 0;
  quizData = [];
  quizScore = { correct: 0, total: 0 };
  currentQuizIndex = 0;
  questionAnswered = false;
  chatHistory = [];
  notesContent = "";
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) chatMessages.innerHTML = "";
}

function showUploadForm() {
  document.getElementById("uploadForm").style.display = "flex";
  document.getElementById("studyActions").style.display = "none";
  document.getElementById("tabs").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("flashcardsContainer").style.display = "none";
  document.getElementById("quizContainer").style.display = "none";
  document.getElementById("chatContainer").style.display = "none";
}

function showStudyWorkspace() {
  document.getElementById("uploadForm").style.display = "none";
  document.getElementById("studyActions").style.display = "flex";
  document.getElementById("tabs").style.display = "flex";
}

function renderNotes() {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = marked.parse(notesContent || "");
  renderMath(resultsDiv);
}

function renderChatHistory() {
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = "";
  chatHistory.forEach((msg) => {
    const parseMarkdown = msg.role === "assistant";
    const msgEl = appendChatMessage(msg.role, msg.content, parseMarkdown);
    if (parseMarkdown) {
      renderMath(msgEl);
    }
  });
}

function getActiveTab() {
  return document.querySelector(".tab-btn.active")?.dataset.tab || "notes";
}

function persistStudyState() {
  if (!notesContent && !flashcardsData.length && !quizData.length && !chatHistory.length) {
    localStorage.removeItem(STUDY_STATE_KEY);
    return;
  }

  const state = {
    notesContent,
    flashcardsData,
    currentCardIndex,
    quizData,
    quizScore,
    currentQuizIndex,
    questionAnswered,
    chatHistory,
    activeTab: getActiveTab(),
    fileNames: currentFiles.map((file) => file.name),
  };

  localStorage.setItem(STUDY_STATE_KEY, JSON.stringify(state));
}

function clearStudyState() {
  localStorage.removeItem(STUDY_STATE_KEY);
}

function restoreStudyState() {
  const rawState = localStorage.getItem(STUDY_STATE_KEY);
  if (!rawState) {
    showUploadForm();
    return;
  }

  try {
    const state = JSON.parse(rawState);
    notesContent = state.notesContent || "";
    flashcardsData = Array.isArray(state.flashcardsData) ? state.flashcardsData : [];
    currentCardIndex = Number.isInteger(state.currentCardIndex) ? state.currentCardIndex : 0;
    quizData = Array.isArray(state.quizData) ? state.quizData : [];
    quizScore = state.quizScore || { correct: 0, total: 0 };
    currentQuizIndex = Number.isInteger(state.currentQuizIndex) ? state.currentQuizIndex : 0;
    questionAnswered = Boolean(state.questionAnswered);
    chatHistory = Array.isArray(state.chatHistory) ? state.chatHistory : [];
    currentFiles = [];

    if (notesContent) {
      renderNotes();
    }
    if (flashcardsData.length) {
      currentCardIndex = Math.min(currentCardIndex, flashcardsData.length - 1);
      renderFlashcard();
    }
    if (quizData.length) {
      currentQuizIndex = Math.min(currentQuizIndex, quizData.length - 1);
      renderCurrentQuestion();
    } else {
      updateScoreDisplay();
    }
    if (chatHistory.length) {
      renderChatHistory();
    }

    showStudyWorkspace();
    setActiveTab(state.activeTab || "notes");
  } catch (error) {
    clearStudyState();
    showUploadForm();
  }
}

dropZone.addEventListener("click", () => pdfInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const files = Array.from(e.dataTransfer.files).filter(
    (file) => file.type === "application/pdf",
  );

  if (files.length) {
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    pdfInput.files = dataTransfer.files;
    currentFiles = files;
    updateDropZoneText(files);
    resetGeneratedContent();
  }
});

pdfInput.addEventListener("change", () => {
  currentFiles = Array.from(pdfInput.files);
  updateDropZoneText(currentFiles);
  resetGeneratedContent();
});

function renderMath(el) {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    });
  }
}

document
  .getElementById("uploadForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display = "none";
    document.getElementById("quizContainer").style.display = "none";
    document.getElementById("tabs").style.display = "none";
    showLoadingScreen();
    document.getElementById("generateBtn").disabled = true;

    const files = Array.from(document.getElementById("pdfFile").files).filter(
      (file) => file.type === "application/pdf",
    );

    if (!files.length) {
      alert("Please select at least one PDF file.");
      return;
    }

    currentFiles = files;

    const formData = new FormData();
    currentFiles.forEach((file) => formData.append("file", file));
    formData.append("model", selectedModel);

    try {
      const response = await fetch("/generate-all", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        if (data.notes) {
          notesContent = data.notes;
          renderNotes();
        }

        if (data.flashcards) {
          flashcardsData = data.flashcards;
          currentCardIndex = 0;
          renderFlashcard();
        }

        if (data.quiz) {
          quizData = data.quiz;
          currentQuizIndex = 0;
          questionAnswered = false;
          quizScore = { correct: 0, total: 0 };
          renderCurrentQuestion();
        }

        showStudyWorkspace();
        setActiveTab("notes");
        persistStudyState();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during text generation.");
    } finally {
      onAiFinished();
      document.getElementById("generateBtn").disabled = false;
    }
  });

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    setActiveTab(this.dataset.tab);
  });
});

function setActiveTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");

  if (tab === "notes") {
    document.getElementById("results").style.display = "block";
    document.getElementById("flashcardsContainer").style.display = "none";
    document.getElementById("quizContainer").style.display = "none";
    document.getElementById("chatContainer").style.display = "none";
  } else if (tab === "flashcards") {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display = "block";
    document.getElementById("quizContainer").style.display = "none";
    document.getElementById("chatContainer").style.display = "none";
  } else if (tab === "quiz") {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display = "none";
    document.getElementById("quizContainer").style.display = "block";
    document.getElementById("chatContainer").style.display = "none";
  } else if (tab === "chat") {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display = "none";
    document.getElementById("quizContainer").style.display = "none";
    document.getElementById("chatContainer").style.display = "flex";
    document.getElementById("chatInput").focus();
  }

  persistStudyState();
}

async function loadFlashcards() {
  if (!currentFiles.length) return;

  document.getElementById("flashcardsContainer").style.display = "none";
  showLoadingScreen();

  const formData = new FormData();
  currentFiles.forEach((file) => formData.append("file", file));
  formData.append("model", selectedModel);

  try {
    const response = await fetch("/flashcards", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
    } else {
      flashcardsData = data.flashcards;
      currentCardIndex = 0;
      renderFlashcard();
      document.getElementById("flashcardsContainer").style.display = "block";
      persistStudyState();
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred generating flashcards.");
  } finally {
    onAiFinished();
  }
}

function renderFlashcard() {
  if (flashcardsData.length === 0) return;

  const card = flashcardsData[currentCardIndex];
  const deck = document.getElementById("flashcardDeck");

  deck.innerHTML = `
    <div class="flashcard" onclick="this.classList.toggle('flipped')">
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <p>${card.front}</p>
          <span class="flip-hint">CLICK TO FLIP</span>
        </div>
        <div class="flashcard-back">
          <p>${card.back}</p>
          <span class="flip-hint">CLICK TO FLIP</span>
        </div>
      </div>
    </div>
  `;

  renderMath(deck);

  document.getElementById("cardCounter").textContent =
    `${currentCardIndex + 1} / ${flashcardsData.length}`;
  document.getElementById("prevCard").disabled = currentCardIndex === 0;
  document.getElementById("nextCard").disabled =
    currentCardIndex === flashcardsData.length - 1;
}

document.getElementById("prevCard").addEventListener("click", () => {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    renderFlashcard();
    persistStudyState();
  }
});

document.getElementById("nextCard").addEventListener("click", () => {
  if (currentCardIndex < flashcardsData.length - 1) {
    currentCardIndex++;
    renderFlashcard();
    persistStudyState();
  }
});

async function loadQuiz() {
  if (!currentFiles.length) return;

  document.getElementById("quizContainer").style.display = "none";
  showLoadingScreen();

  const formData = new FormData();
  currentFiles.forEach((file) => formData.append("file", file));
  formData.append("model", selectedModel);

  try {
    const response = await fetch("/quiz", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
    } else {
      quizData = data.quiz;
      currentQuizIndex = 0;
      questionAnswered = false;
      quizScore = { correct: 0, total: 0 };
      renderCurrentQuestion();
      document.getElementById("quizContainer").style.display = "block";
      persistStudyState();
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred generating the quiz.");
  } finally {
    onAiFinished();
  }
}

function renderCurrentQuestion() {
  const container = document.getElementById("quizQuestions");
  container.innerHTML = "";
  questionAnswered = false;

  if (currentQuizIndex >= quizData.length) return;

  const q = quizData[currentQuizIndex];
  const i = currentQuizIndex;

  const qDiv = document.createElement("div");
  qDiv.className = "quiz-question";
  qDiv.dataset.index = i;

  let optionsHtml = "";
  const validLetters = ["A", "B", "C", "D"];
  for (const letter of validLetters) {
    if (q.options[letter] !== undefined) {
      optionsHtml += `
        <div class="quiz-option" data-letter="${letter}">
          <span class="option-letter">${letter}</span>
          <span class="option-text">${q.options[letter]}</span>
        </div>
      `;
    }
  }

  qDiv.innerHTML = `
    <p class="quiz-question-counter">QUESTION ${i + 1} OF ${quizData.length}</p>
    <p class="quiz-question-text">${q.question}</p>
    <div class="quiz-options">${optionsHtml}</div>
  `;

  container.appendChild(qDiv);
  renderMath(container);

  qDiv.querySelectorAll(".quiz-option").forEach((opt) => {
    opt.addEventListener("click", () => handleAnswer(opt, q));
  });

  updateScoreDisplay();
  persistStudyState();
}

function handleAnswer(selectedOpt, question) {
  if (questionAnswered) return;
  questionAnswered = true;

  const chosenLetter = selectedOpt.dataset.letter;
  const correctAnswer = question.answer.trim().charAt(0).toUpperCase();
  const isCorrect = chosenLetter === correctAnswer;
  question.chosen = chosenLetter;
  question.isCorrect = isCorrect;

  quizScore.total++;
  if (isCorrect) quizScore.correct++;

  const allOptions = selectedOpt.parentElement.querySelectorAll(".quiz-option");
  allOptions.forEach((opt) => {
    opt.classList.add("disabled");
    const letter = opt.dataset.letter;
    if (letter === correctAnswer) {
      opt.classList.add("correct");
      if (!isCorrect) {
        const badge = document.createElement("span");
        badge.className = "correct-badge";
        badge.textContent = "CORRECT";
        opt.appendChild(badge);
      }
    } else if (letter === chosenLetter && !isCorrect) {
      opt.classList.add("wrong");
    }
  });

  updateScoreDisplay();

  const quizActions = document.createElement("div");
  quizActions.className = "quiz-actions";

  const explainBtn = document.createElement("button");
  explainBtn.className = "explain-btn";
  explainBtn.textContent = "EXPLAIN WITH AI";
  explainBtn.addEventListener("click", () =>
    explainQuestion(question, chosenLetter, explainBtn),
  );
  quizActions.appendChild(explainBtn);

  if (currentQuizIndex < quizData.length - 1) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "explain-btn";
    nextBtn.textContent = "NEXT QUESTION";
    nextBtn.addEventListener("click", () => {
      currentQuizIndex++;
      renderCurrentQuestion();
      persistStudyState();
    });
    quizActions.appendChild(nextBtn);
  } else {
    const moreBtn = document.createElement("button");
    moreBtn.className = "explain-btn";
    moreBtn.textContent = "GENERATE MORE QUESTIONS";
    moreBtn.addEventListener("click", async () => {
      quizData = [];
      currentQuizIndex = 0;
      questionAnswered = false;
      await loadQuiz();
    });
    quizActions.appendChild(moreBtn);
  }

  selectedOpt.closest(".quiz-question").appendChild(quizActions);
  persistStudyState();
}

function updateScoreDisplay() {
  document.getElementById("scoreText").textContent =
    `SCORE: ${quizScore.correct} / ${quizScore.total}`;
}

async function explainQuestion(question, chosen, btn) {
  btn.disabled = true;
  btn.textContent = "LOADING...";

  try {
    const response = await fetch("/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question.question,
        options: question.options,
        answer: question.answer,
        chosen: chosen,
        model: selectedModel,
      }),
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      btn.textContent = "EXPLAIN WITH AI";
      btn.disabled = false;
      return;
    }

    const explanationDiv = document.createElement("div");
    explanationDiv.className = "ai-explanation";
    explanationDiv.innerHTML = marked.parse(data.explanation);
    btn.parentElement.appendChild(explanationDiv);
    renderMath(explanationDiv);
    question.explanation = data.explanation;
    persistStudyState();
    btn.remove();
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to get explanation.");
    btn.textContent = "EXPLAIN WITH AI";
    btn.disabled = false;
  }
}

document
  .getElementById("chatForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    appendChatMessage("user", message);
    chatHistory.push({ role: "user", content: message });
    persistStudyState();

    const typingEl = appendChatMessage("assistant", "...");
    typingEl.classList.add("chat-typing");

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          notes: notesContent,
          history: chatHistory,
        }),
      });

      const data = await response.json();

      typingEl.remove();

      if (data.error) {
        appendChatMessage(
          "assistant",
          "Sorry, something went wrong: " + data.error,
        );
      } else {
        const replyEl = appendChatMessage("assistant", data.reply, true);
        chatHistory.push({ role: "assistant", content: data.reply });
        renderMath(replyEl);
        persistStudyState();
      }
    } catch (error) {
      typingEl.remove();
      appendChatMessage(
        "assistant",
        "Failed to get a response. Please try again.",
      );
      console.error("Chat error:", error);
    }
  });

function appendChatMessage(role, content, parseMarkdown = false) {
  const messagesDiv = document.getElementById("chatMessages");
  const msgEl = document.createElement("div");
  msgEl.className = `chat-message chat-${role}`;

  if (parseMarkdown) {
    msgEl.innerHTML = marked.parse(content);
  } else {
    msgEl.textContent = content;
  }

  messagesDiv.appendChild(msgEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msgEl;
}

let snakeInterval = null;
let snakeRunning = false;
let aiFinished = false;

function initSnakeGame() {
  const canvas = document.getElementById("snakeCanvas");
  const ctx = canvas.getContext("2d");
  const gridSize = 15;
  const tileCount = canvas.width / gridSize;

  let snake = [{ x: 10, y: 10 }];
  let food = { x: 5, y: 5 };
  let dx = 0;
  let dy = 0;
  let score = 0;
  let gameOver = false;

  function placeFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    for (const seg of snake) {
      if (seg.x === food.x && seg.y === food.y) {
        placeFood();
        return;
      }
    }
  }

  function draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--highlight")
      .trim();
    ctx.beginPath();
    ctx.arc(
      food.x * gridSize + gridSize / 2,
      food.y * gridSize + gridSize / 2,
      gridSize / 2 - 1,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
      ctx.roundRect
        ? (ctx.beginPath(),
          ctx.roundRect(
            seg.x * gridSize + 1,
            seg.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2,
            3,
          ),
          ctx.fill())
        : ctx.fillRect(
            seg.x * gridSize + 1,
            seg.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2,
          );
    });

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Caveat, Patrick Hand, cursive";
      ctx.textAlign = "center";
      ctx.fillText("game over!", canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = "18px Caveat, Patrick Hand, cursive";
      ctx.fillText("tap to restart", canvas.width / 2, canvas.height / 2 + 20);
    }
  }

  function update() {
    if (gameOver || (dx === 0 && dy === 0)) {
      draw();
      return;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    for (const seg of snake) {
      if (seg.x === head.x && seg.y === head.y) {
        gameOver = true;
        draw();
        return;
      }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      document.getElementById("snakeScore").textContent = `score: ${score}`;
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function setDirection(dir) {
    if (gameOver) {
      snake = [{ x: 10, y: 10 }];
      dx = 0;
      dy = 0;
      score = 0;
      gameOver = false;
      document.getElementById("snakeScore").textContent = "score: 0";
      placeFood();
      return;
    }
    switch (dir) {
      case "up":
        if (dy !== 1) {
          dx = 0;
          dy = -1;
        }
        break;
      case "down":
        if (dy !== -1) {
          dx = 0;
          dy = 1;
        }
        break;
      case "left":
        if (dx !== 1) {
          dx = -1;
          dy = 0;
        }
        break;
      case "right":
        if (dx !== -1) {
          dx = 1;
          dy = 0;
        }
        break;
    }
  }

  function onKey(e) {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    if (map[e.key]) {
      e.preventDefault();
      setDirection(map[e.key]);
    }
  }

  canvas.addEventListener("click", () => {
    if (gameOver) {
      setDirection("right");
    }
  });

  document.addEventListener("keydown", onKey);
  placeFood();
  draw();

  snakeInterval = setInterval(update, 110);
  snakeRunning = true;

  return function cleanup() {
    clearInterval(snakeInterval);
    snakeInterval = null;
    snakeRunning = false;
    document.removeEventListener("keydown", onKey);
  };
}

let cleanupSnake = null;

document.getElementById("playSnakeBtn").addEventListener("click", () => {
  document.getElementById("loadingDefault").style.display = "none";
  const snakeGame = document.getElementById("snakeGame");
  snakeGame.style.display = "flex";
  cleanupSnake = initSnakeGame();

  if (aiFinished) {
    document.getElementById("seeNotesBtn").style.display = "inline-block";
  }
});

document.getElementById("seeNotesBtn").addEventListener("click", () => {
  hideLoadingScreen();
});

let loadingTimerInterval = null;
let loadingStartTime = null;

function updateLoadingTimer() {
  const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins + ":" + String(secs).padStart(2, "0");
  document.getElementById("loadingTimer").textContent = timeStr;
  document.getElementById("snakeTimer").textContent = timeStr;
}

function showLoadingScreen() {
  aiFinished = false;
  document.getElementById("loadingDefault").style.display = "flex";
  document.getElementById("loadingDefault").style.flexDirection = "column";
  document.getElementById("loadingDefault").style.alignItems = "center";
  document.getElementById("snakeGame").style.display = "none";
  document.getElementById("seeNotesBtn").style.display = "none";
  document.getElementById("loading").style.display = "flex";

  loadingStartTime = Date.now();
  updateLoadingTimer();
  loadingTimerInterval = setInterval(updateLoadingTimer, 1000);

  if (cleanupSnake) {
    cleanupSnake();
    cleanupSnake = null;
  }
}

function hideLoadingScreen() {
  document.getElementById("loading").style.display = "none";
  if (loadingTimerInterval) {
    clearInterval(loadingTimerInterval);
    loadingTimerInterval = null;
  }
  if (cleanupSnake) {
    cleanupSnake();
    cleanupSnake = null;
  }
}

function onAiFinished() {
  aiFinished = true;
  if (snakeRunning) {
    document.getElementById("seeNotesBtn").style.display = "inline-block";
  } else {
    hideLoadingScreen();
  }
}

document.getElementById("exportFlashcardsCsv").addEventListener("click", () => {
  if (flashcardsData.length === 0) return;
  const escape = (str) => '"' + String(str).replace(/"/g, '""') + '"';
  const rows = [];
  flashcardsData.forEach((card) => {
    rows.push(escape(card.front) + "," + escape(card.back));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "flashcards.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("abandonBtn").addEventListener("click", () => {
  clearStudyState();
  currentFiles = [];
  resetGeneratedContent();
  pdfInput.value = "";
  updateDropZoneText([]);
  document.getElementById("results").innerHTML = "";
  document.getElementById("flashcardDeck").innerHTML = "";
  document.getElementById("quizQuestions").innerHTML = "";
  document.getElementById("scoreText").textContent = "SCORE: 0 / 0";
  showUploadForm();
});

restoreStudyState();

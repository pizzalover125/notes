let currentFile = null;
let flashcardsData = [];
let currentCardIndex = 0;
let quizData = [];
let quizScore = { correct: 0, total: 0 };
let currentQuizIndex = 0;
let questionAnswered = false;

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
    document.getElementById("loading").style.display = "flex";
    document.getElementById("generateBtn").disabled = true;

    const fileInput = document.getElementById("pdfFile");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a PDF file.");
      return;
    }

    currentFile = file;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = marked.parse(data.notes);
        renderMath(resultsDiv);
        resultsDiv.style.display = "block";
        document.getElementById("tabs").style.display = "flex";
        document.getElementById("uploadForm").style.display = "none";
        setActiveTab("notes");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during text generation.");
    } finally {
      document.getElementById("loading").style.display = "none";
      document.getElementById("generateBtn").disabled = false;
    }
  });

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async function () {
    const tab = this.dataset.tab;
    setActiveTab(tab);

    if (tab === "flashcards" && flashcardsData.length === 0) {
      await loadFlashcards();
    }
    if (tab === "quiz" && quizData.length === 0) {
      await loadQuiz();
    }
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
  } else if (tab === "flashcards") {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display =
      flashcardsData.length > 0 ? "block" : "none";
    document.getElementById("quizContainer").style.display = "none";
  } else if (tab === "quiz") {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display = "none";
    document.getElementById("quizContainer").style.display =
      quizData.length > 0 ? "block" : "none";
  }
}

async function loadFlashcards() {
  if (!currentFile) return;

  document.getElementById("flashcardsContainer").style.display = "none";
  document.getElementById("loading").style.display = "flex";

  const formData = new FormData();
  formData.append("file", currentFile);

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
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred generating flashcards.");
  } finally {
    document.getElementById("loading").style.display = "none";
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
  }
});

document.getElementById("nextCard").addEventListener("click", () => {
  if (currentCardIndex < flashcardsData.length - 1) {
    currentCardIndex++;
    renderFlashcard();
  }
});

const inputElement = document.getElementById("pdfFile");
if (inputElement) {
  inputElement.addEventListener("change", function () {
    const label = document.querySelector("label.custom-file-upload");
    if (this.files && this.files.length > 0) {
      label.textContent = this.files[0].name.toUpperCase();
    } else {
      label.textContent = "CHOOSE PDF";
    }
    flashcardsData = [];
    currentCardIndex = 0;
    quizData = [];
    quizScore = { correct: 0, total: 0 };
    currentQuizIndex = 0;
    questionAnswered = false;
  });
} else {
  console.error("File input element not found");
}

// Quiz logic
async function loadQuiz() {
  if (!currentFile) return;

  document.getElementById("quizContainer").style.display = "none";
  document.getElementById("loading").style.display = "flex";

  const formData = new FormData();
  formData.append("file", currentFile);

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
      renderCurrentQuestion();
      document.getElementById("quizContainer").style.display = "block";
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred generating the quiz.");
  } finally {
    document.getElementById("loading").style.display = "none";
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

  // Attach click handlers to options
  qDiv.querySelectorAll(".quiz-option").forEach((opt) => {
    opt.addEventListener("click", () => handleAnswer(opt, q));
  });

  document.getElementById("nextQuestion").style.display = "none";
  document.getElementById("generateMoreQuiz").style.display = "none";
  updateScoreDisplay();
}

function handleAnswer(selectedOpt, question) {
  if (questionAnswered) return;
  questionAnswered = true;

  const chosenLetter = selectedOpt.dataset.letter;
  const correctAnswer = question.answer.trim().charAt(0).toUpperCase();
  const isCorrect = chosenLetter === correctAnswer;

  quizScore.total++;
  if (isCorrect) quizScore.correct++;

  const allOptions = selectedOpt.parentElement.querySelectorAll(".quiz-option");
  allOptions.forEach((opt) => {
    opt.classList.add("disabled");
    const letter = opt.dataset.letter;
    if (letter === correctAnswer) {
      opt.classList.add("correct");
    } else if (letter === chosenLetter && !isCorrect) {
      opt.classList.add("wrong");
    }
  });

  updateScoreDisplay();

  // Show next or generate more
  if (currentQuizIndex < quizData.length - 1) {
    document.getElementById("nextQuestion").style.display = "inline-block";
  } else {
    document.getElementById("generateMoreQuiz").style.display = "inline-block";
  }
}

function updateScoreDisplay() {
  document.getElementById("scoreText").textContent =
    `SCORE: ${quizScore.correct} / ${quizScore.total}`;
}

document.getElementById("nextQuestion").addEventListener("click", () => {
  currentQuizIndex++;
  renderCurrentQuestion();
});

document
  .getElementById("generateMoreQuiz")
  .addEventListener("click", async () => {
    quizData = [];
    currentQuizIndex = 0;
    questionAnswered = false;
    await loadQuiz();
  });

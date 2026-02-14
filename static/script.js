let currentFile = null;
let flashcardsData = [];
let currentCardIndex = 0;

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
    document.getElementById("tabs").style.display = "none";
    document.getElementById("loading").style.display = "block";
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

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async function () {
    const tab = this.dataset.tab;
    setActiveTab(tab);

    if (tab === "flashcards" && flashcardsData.length === 0) {
      await loadFlashcards();
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
  } else {
    document.getElementById("results").style.display = "none";
    document.getElementById("flashcardsContainer").style.display =
      flashcardsData.length > 0 ? "block" : "none";
  }
}

async function loadFlashcards() {
  if (!currentFile) return;

  document.getElementById("flashcardsContainer").style.display = "none";
  document.getElementById("loading").style.display = "block";

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
    // Reset flashcards when a new file is chosen
    flashcardsData = [];
    currentCardIndex = 0;
  });
} else {
  console.error("File input element not found");
}

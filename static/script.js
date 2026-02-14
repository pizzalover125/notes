document
  .getElementById("uploadForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    document.getElementById("results").style.display = "none";
    document.getElementById("loading").style.display = "block";
    document.getElementById("generateBtn").disabled = true;

    const fileInput = document.getElementById("pdfFile");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a PDF file.");
      return;
    }

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
        // Success
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = marked.parse(data.notes);
        resultsDiv.style.display = "block";
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during text generation.");
    } finally {
      document.getElementById("loading").style.display = "none";
      document.getElementById("generateBtn").disabled = false;
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
  });
} else {
  console.error("File input element not found");
}

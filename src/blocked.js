// Blocked page script: enables keyboard shortcut for quick return to YouTube Home.
document.addEventListener("DOMContentLoaded", () => {
  const homeButton = document.getElementById("home-button");
  const homeUrl = "https://www.youtube.com/";

  function goHome() {
    window.location.href = homeUrl;
  }

  // Allow pressing Enter or Escape from anywhere on the page to return home
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      goHome();
    }
  });

  if (homeButton) {
    homeButton.addEventListener("click", (event) => {
      event.preventDefault();
      goHome();
    });
  }
});

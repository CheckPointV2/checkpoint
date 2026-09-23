document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tool-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".tool-group");
      const wasOpen = group.classList.contains("open");
      document.querySelectorAll(".tool-group.open").forEach((g) => g.classList.remove("open"));
      if (!wasOpen) group.classList.add("open");
    });
  });
});

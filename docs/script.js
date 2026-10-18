// Modal functions
function openModal(imageSrc, imageAlt) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");

  modal.style.display = "block";
  modalImg.src = imageSrc;
  modalImg.alt = imageAlt;

  // Prevent body scrolling when modal is open
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none";

  // Restore body scrolling
  document.body.style.overflow = "auto";
}

// Close modal when pressing Escape key
document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closeModal();
  }
});

// Scroll to top functionality
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// Show/hide scroll to top button based on scroll position
function handleScroll() {
  const scrollButton = document.getElementById("scrollToTop");
  const scrollPosition =
    window.pageYOffset || document.documentElement.scrollTop;

  if (scrollPosition > 300) {
    scrollButton.classList.add("visible");
  } else {
    scrollButton.classList.remove("visible");
  }
}

// Throttle scroll events for better performance
let ticking = false;
window.addEventListener("scroll", function() {
  if (!ticking) {
    requestAnimationFrame(function() {
      handleScroll();
      ticking = false;
    });
    ticking = true;
  }
});

// Theme functionality
function getSystemTheme() {
  return window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme() {
  return localStorage.getItem("theme") || "system";
}

function storeTheme(theme) {
  localStorage.setItem("theme", theme);
}

function applyTheme(theme) {
  const html = document.documentElement;

  // Remove existing theme attributes
  html.removeAttribute("data-theme");

  let actualTheme = theme;

  if (theme === "system") {
    // Let CSS handle system preference
    if (getSystemTheme() === "dark") {
      actualTheme = "dark";
      html.setAttribute("data-theme", "system-dark");
    } else {
      actualTheme = "light";
      html.setAttribute("data-theme", "system-light");
    }
  } else {
    html.setAttribute("data-theme", theme);
    actualTheme = theme;
  }

  const darkIcons = document.querySelectorAll(".theme-dark-only");
  const lightIcons = document.querySelectorAll(".theme-light-only");

  darkIcons.forEach(icon => {
    icon.style.display = actualTheme === "dark" ? "block" : "none";
  });
  lightIcons.forEach(icon => {
    icon.style.display = actualTheme === "light" ? "block" : "none";
  });
}

function updateThemeButtons(activeTheme) {
  const themeButtons = document.querySelectorAll(".theme-btn");
  themeButtons.forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.theme === activeTheme) {
      btn.classList.add("active");
    }
  });
}

function initTheme() {
  const storedTheme = getStoredTheme();
  applyTheme(storedTheme);
  updateThemeButtons(storedTheme);

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      const currentTheme = getStoredTheme();
      if (currentTheme === "system") {
        applyTheme("system");
      }
    });
  }
}

function setTheme(theme) {
  storeTheme(theme);
  applyTheme(theme);
  updateThemeButtons(theme);
}

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  // Initialize theme
  initTheme();

  // Add theme button event listeners
  const themeButtons = document.querySelectorAll(".theme-btn");
  themeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
    });
  });

  // Show the page
  document.body.style.display = "block";
  loadChangelog();
});

function escapeChangelog(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderChangelog(markdown) {
  const releases = [];
  let release = null;
  let section = null;

  markdown.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trimEnd();
    const releaseMatch = line.match(/^##\s+\[(\d+\.\d+\.\d+)\](?:\s*-\s*(.+))?$/);
    if (releaseMatch) {
      release = { version: releaseMatch[1], label: (releaseMatch[2] || "").trim(), sections: [] };
      releases.push(release);
      section = null;
      return;
    }
    if (!release) return;
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), items: [] };
      release.sections.push(section);
      return;
    }
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (!bulletMatch || !section) return;
    const text = bulletMatch[2].replace(/\*\*/g, "").trim();
    if (!text) return;
    const depth = Math.floor(bulletMatch[1].replace(/\t/g, "  ").length / 2);
    section.items.push({ text, depth });
  });

  return releases
    .map(entry => {
      const sections = entry.sections.filter(part => part.items.length > 0);
      if (sections.length === 0) return "";
      const title = entry.label ? `${entry.version} — ${entry.label}` : entry.version;
      const body = sections
        .map(part => {
          const items = part.items
            .map(item => `<li style="margin-left:${item.depth * 16}px">${escapeChangelog(item.text)}</li>`)
            .join("");
          return `<h4>${escapeChangelog(part.title)}</h4><ul>${items}</ul>`;
        })
        .join("");
      return `<article><h3>${escapeChangelog(title)}</h3>${body}</article>`;
    })
    .join("");
}

function loadChangelog() {
  const target = document.getElementById("changelog-body");
  if (!target) return;
  const file = target.dataset.changelog;
  if (!file) return;
  fetch(file)
    .then(response => (response.ok ? response.text() : ""))
    .then(markdown => {
      target.innerHTML = markdown ? renderChangelog(markdown) : "";
    })
    .catch(() => {
      target.textContent = "";
    });
}

// Change year in footer
const year = new Date().getFullYear();
const footerText = document.getElementById("footer-text");
if (footerText) {
  footerText.innerHTML = `&copy; ${year} DevNullifier. Released under the MIT License.`;
}

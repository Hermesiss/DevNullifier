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
});

// Change year in footer
const year = new Date().getFullYear();
const footerText = document.getElementById("footer-text");
if (footerText) {
  footerText.innerHTML = `&copy; ${year} DevNullifier. Released under the MIT License.`;
}

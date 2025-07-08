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

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  // Show the page
  document.body.style.display = "block";
});

// Change year in footer
const year = new Date().getFullYear();
const footerText = document.getElementById("footer-text");
footerText.innerHTML = `&copy; ${year} DevNullifier. Released under the MIT License.`;

const backgroundSlides = [...document.querySelectorAll(".home-background-slide")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const slideIntervalMilliseconds = 6000;
let activeBackgroundIndex = 0;
let backgroundTimer = null;

function showBackground(index) {
  activeBackgroundIndex = index;
  backgroundSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeBackgroundIndex);
  });
}

function nextBackground() {
  showBackground((activeBackgroundIndex + 1) % backgroundSlides.length);
}

function stopBackgroundLoop() {
  if (!backgroundTimer) return;
  window.clearInterval(backgroundTimer);
  backgroundTimer = null;
}

function startBackgroundLoop() {
  stopBackgroundLoop();
  if (backgroundSlides.length < 2 || reducedMotion.matches || document.hidden) return;
  backgroundTimer = window.setInterval(nextBackground, slideIntervalMilliseconds);
}

function handleMotionPreference() {
  if (reducedMotion.matches) {
    stopBackgroundLoop();
    showBackground(0);
  } else {
    startBackgroundLoop();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopBackgroundLoop();
  else startBackgroundLoop();
});

if (typeof reducedMotion.addEventListener === "function") {
  reducedMotion.addEventListener("change", handleMotionPreference);
} else if (typeof reducedMotion.addListener === "function") {
  reducedMotion.addListener(handleMotionPreference);
}

showBackground(0);
startBackgroundLoop();

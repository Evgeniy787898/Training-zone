<template>
  <div class="splash-screen">
    <div class="splash-screen__glow" aria-hidden="true"></div>
    <div class="splash-screen__content">
      <h1 class="splash-screen__title">TZONA</h1>
      <p class="splash-screen__subtitle">Training Zone</p>
      <div class="splash-screen__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60">
        <span class="splash-screen__progress-fill"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// SplashScreen component
</script>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, rgba(66, 133, 244, 0.3), rgba(11, 11, 11, 0.96));
  overflow: hidden;
}

.splash-screen__glow {
  position: absolute;
  inset: -40vh -40vw;
  background: radial-gradient(circle, rgba(66, 133, 244, 0.45), rgba(156, 39, 176, 0.2), transparent 65%);
  animation: pulse-glow 6s ease-in-out infinite;
}

.splash-screen__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  text-align: center;
}

.splash-screen__title {
  margin: 0;
  font-size: clamp(3.2rem, 2.8rem + 6vw, 5rem);
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: linear-gradient(120deg, var(--color-accent), var(--color-success) 65%, var(--color-text-muted));
  -webkit-background-clip: text;
  color: transparent;
  text-shadow: 0 0 2.6rem rgba(66, 133, 244, 0.55);
}

.splash-screen__subtitle {
  margin: 0;
  font-size: clamp(1rem, 0.95rem + 0.6vw, 1.4rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(232, 234, 237, 0.75);
}

.splash-screen__progress {
  inline-size: clamp(12rem, 10rem + 20vw, 20rem);
  block-size: 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.splash-screen__progress-fill {
  display: block;
  inline-size: 60%;
  block-size: 100%;
  background: linear-gradient(120deg, rgba(66, 133, 244, 0.85), rgba(156, 39, 176, 0.7));
  animation: sweep 2.4s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.05); opacity: 0.85; }
}

@keyframes sweep {
  0% { transform: translateX(-40%); }
  50% { transform: translateX(10%); }
  100% { transform: translateX(-40%); }
}
</style>

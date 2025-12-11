<template>
  <div class="avatar-viewer">
    <TresCanvas clear-color="#0a0a0a" shadows>
      <TresPerspectiveCamera :position="[0, 2, 5]" :look-at="[0, 1, 0]" />
      <OrbitControls :enable-damping="true" :damping-factor="0.05" />

      <!-- Lighting -->
      <TresAmbientLight :intensity="0.5" />
      <TresDirectionalLight :position="[5, 5, 5]" :intensity="1" cast-shadow />
      <TresPointLight :position="[-5, 2, 0]" :intensity="0.8" color="#00ffcc" />

      <!-- The Avatar (Procedural Representation) -->
      <TresGroup ref="avatarGroup">
        <!-- Head -->
        <TresMesh :position="[0, 1.7, 0]">
           <TresSphereGeometry :args="[0.12, 32, 32]" />
           <TresMeshStandardMaterial color="#e0e0e0" :roughness="0.3" :metalness="0.5" />
        </TresMesh>
        
        <!-- Torso -->
        <TresMesh :position="[0, 1.2, 0]" :scale="bodyScale">
           <TresCylinderGeometry :args="[0.18, 0.15, 0.7, 32]" />
           <TresMeshStandardMaterial color="#a0a0a0" :roughness="0.2" :metalness="0.6" />
        </TresMesh>

        <!-- Hips -->
         <TresMesh :position="[0, 0.8, 0]" :scale="hipsScale">
           <TresCylinderGeometry :args="[0.15, 0.16, 0.2, 32]" />
           <TresMeshStandardMaterial color="#a0a0a0" />
        </TresMesh>

        <!-- Arms (Left/Right) -->
        <TresMesh :position="[-0.25, 1.3, 0]" :rotation="[0, 0, 0.2]">
           <TresCapsuleGeometry :args="[0.05, 0.7, 4, 8]" />
           <TresMeshStandardMaterial color="#d0d0d0" />
        </TresMesh>
         <TresMesh :position="[0.25, 1.3, 0]" :rotation="[0, 0, -0.2]">
           <TresCapsuleGeometry :args="[0.05, 0.7, 4, 8]" />
           <TresMeshStandardMaterial color="#d0d0d0" />
        </TresMesh>

        <!-- Legs -->
        <TresMesh :position="[-0.15, 0.4, 0]">
           <TresCapsuleGeometry :args="[0.07, 0.8, 4, 8]" />
           <TresMeshStandardMaterial color="#b0b0b0" />
        </TresMesh>
         <TresMesh :position="[0.15, 0.4, 0]">
           <TresCapsuleGeometry :args="[0.07, 0.8, 4, 8]" />
           <TresMeshStandardMaterial color="#b0b0b0" />
        </TresMesh>

      </TresGroup>

      <!-- Floor grid -->
      <TresGridHelper :args="[10, 10, 0x444444, 0x222222]" />

    </TresCanvas>

    <div class="overlay-ui">
        <div class="mode-toggle">
            <button :class="{ active: mode === 'current' }" @click="mode = 'current'">Current</button>
            <button :class="{ active: mode === 'ideal' }" @click="mode = 'ideal'">Ideal (Apollo)</button>
        </div>
        
        <div class="evolution-slider">
            <label>Evolution: {{ Math.round(evolution * 100) }}%</label>
            <input type="range" min="0" max="1" step="0.01" v-model.number="evolution" />
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';

const mode = ref<'current' | 'ideal'>('current');
const evolution = ref(0); // 0 = current, 1 = ideal

// Simulation of morphing based on evolution slider
const bodyScale = computed(() => {
    // Current might be wider (fat), Ideal is V-taper
    const currentWidth = [1.2, 1, 1]; // X, Y, Z
    const idealWidth = [1.4, 1.1, 1.1]; // Broader shoulders
    
    // Lerp
    const x = currentWidth[0] + (idealWidth[0] - currentWidth[0]) * evolution.value;
    const y = currentWidth[1] + (idealWidth[1] - currentWidth[1]) * evolution.value;
    return [x, y, 1];
});

const hipsScale = computed(() => {
    // Current might be wider, Ideal is narrower
    const current = 1.1;
    const ideal = 0.95;
    const s = current + (ideal - current) * evolution.value;
    return [s, 1, s];
});

</script>

<style scoped>
.avatar-viewer {
  width: 100%;
  height: 60vh;
  position: relative;
  background: radial-gradient(circle at center, #1a1a1a 0%, #000000 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 255, 204, 0.1);
}

.overlay-ui {
    position: absolute;
    bottom: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: rgba(0,0,0,0.6);
    padding: 16px;
    border-radius: 12px;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.1);
}

.mode-toggle {
    display: flex;
    gap: 10px;
}

.mode-toggle button {
    flex: 1;
    padding: 8px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.mode-toggle button.active {
    background: var(--color-accent, #00ffcc);
    color: black;
    font-weight: bold;
    box-shadow: 0 0 10px var(--color-accent, #00ffcc);
}

.evolution-slider {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: white;
}

input[type="range"] {
    width: 100%;
    accent-color: var(--color-accent, #00ffcc);
}
</style>

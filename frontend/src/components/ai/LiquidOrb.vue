<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const props = defineProps<{
  audioLevel: number;
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';
  isActive: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Mesh | null = null;
let animationId: number | null = null;
let startTime = Date.now();

// Shader uniforms that will be updated
const uniforms = {
  uTime: { value: 0 },
  uAudioLevel: { value: 0 },
  uBaseColor: { value: new THREE.Color(0.2, 0.5, 1.0) },
  uFresnelColor: { value: new THREE.Color(0.4, 0.8, 1.0) },
  uResolution: { value: new THREE.Vector2(300, 300) },
};

// Vertex shader - organic deformation with noise
const vertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vDisplacement;
  
  // Simplex 3D noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  // Fractal Brownian Motion
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    
    // Multi-layered noise for organic deformation
    float slowTime = uTime * 0.3;
    float fastTime = uTime * 0.8;
    
    // Base wave - ultra gentle breathing
    float wave1 = fbm(position * 1.0 + slowTime * 0.3) * 0.05;
    
    // Detail waves - micro ripples
    float wave2 = snoise(position * 2.0 + fastTime) * 0.025;
    float wave3 = snoise(position * 3.0 - fastTime * 0.5) * 0.012;
    
    // Audio reactive component
    float audioWave = snoise(position * 2.0 + uTime) * uAudioLevel * 0.25;
    
    // Combine all displacements
    float displacement = wave1 + wave2 + wave3 + audioWave;
    
    // Add ultra-gentle pulsing breathing
    float breathing = sin(uTime * 0.5) * 0.008 + sin(uTime * 0.8) * 0.005;
    displacement += breathing;
    
    vDisplacement = displacement;
    
    // Apply displacement along normal
    vec3 newPosition = position + normal * displacement;
    
    vPosition = newPosition;
    vWorldPosition = (modelMatrix * vec4(newPosition, 1.0)).xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment shader - premium liquid water with smooth gradients
const fragmentShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform vec3 uBaseColor;
  uniform vec3 uFresnelColor;
  uniform vec2 uResolution;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vDisplacement;
  
  // Smooth color interpolation
  vec3 smoothColor(vec3 a, vec3 b, float t) {
    float st = smoothstep(0.0, 1.0, t);
    return mix(a, b, st);
  }
  
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    
    // Softer Fresnel - less edge glow
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    fresnel = smoothstep(0.0, 1.0, fresnel) * 0.7; // Reduced edge brightness
    
    // Rich color palette - no white
    vec3 deepColor = vec3(0.05, 0.18, 0.45);      // Deep ocean
    vec3 coreColor = vec3(0.1, 0.35, 0.65);       // Ocean core
    vec3 midColor = vec3(0.2, 0.5, 0.8);          // Ocean mid
    vec3 surfaceColor = vec3(0.35, 0.6, 0.88);    // Surface blue
    vec3 edgeColor = vec3(0.45, 0.7, 0.92);       // Subtle edge (not white!)
    
    // Position-based color variation inside (not uniform!)
    float posNoise = sin(vPosition.x * 8.0 + uTime * 0.3) * 
                     sin(vPosition.y * 7.0 - uTime * 0.25) * 
                     sin(vPosition.z * 6.0 + uTime * 0.2) * 0.15 + 0.5;
    
    // Multi-layer gradient with internal variation
    float depthFactor = smoothstep(-0.1, 0.12, vDisplacement);
    vec3 baseColor = smoothColor(deepColor, coreColor, posNoise * 0.6 + depthFactor * 0.4);
    baseColor = smoothColor(baseColor, midColor, depthFactor * 0.5 + posNoise * 0.3);
    baseColor = smoothColor(baseColor, surfaceColor, depthFactor * 0.6 + fresnel * 0.2);
    baseColor = smoothColor(baseColor, edgeColor, fresnel * 0.4); // Reduced edge blend
    
    // Soft specular - COLORED, not white
    vec3 lightDir = normalize(vec3(
      sin(uTime * 0.2) * 0.4 - 0.2,
      cos(uTime * 0.15) * 0.25 - 0.4,
      0.85
    ));
    float specular = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 64.0);
    specular = smoothstep(0.0, 1.0, specular);
    
    // Secondary highlight - also colored
    vec3 lightDir2 = normalize(vec3(0.4, -0.2, 0.9));
    float specular2 = pow(max(dot(reflect(-lightDir2, vNormal), viewDir), 0.0), 96.0);
    specular2 = smoothstep(0.0, 1.0, specular2);
    
    // Soft subsurface scattering
    float sss = pow(max(dot(viewDir, -vNormal + lightDir * 0.4), 0.0), 2.5) * 0.2;
    sss = smoothstep(0.0, 1.0, sss);
    
    // Internal depth glow
    float innerGlow = smoothstep(0.9, 0.0, length(vPosition)) * 0.2;
    
    // Audio reactive glow
    float audioGlow = smoothstep(0.0, 1.0, uAudioLevel) * 0.25;
    
    // Combine effects - NO WHITE, all colored
    vec3 finalColor = baseColor;
    finalColor += specular * surfaceColor * 0.4;   // Colored specular!
    finalColor += specular2 * edgeColor * 0.25;    // Colored highlight!
    finalColor += fresnel * edgeColor * 0.2;       // Subtle edge
    finalColor += sss * midColor * 0.3;
    finalColor += innerGlow * coreColor;
    finalColor += audioGlow * surfaceColor;
    
    // Solid alpha - no transparency variation
    float alpha = 0.95;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function initThreeJS() {
  if (!containerRef.value) return;
  
  const container = containerRef.value;
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 300;
  
  // Scene
  scene = new THREE.Scene();
  
  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 3;
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    premultipliedAlpha: false
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit for performance
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  
  // Optimized sphere (512x512 = 262K faces - smooth AND fast)
  const geometry = new THREE.SphereGeometry(1, 512, 512);
  
  // Custom shader material
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });
  
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);
  
  // Point light
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(2, 2, 3);
  scene.add(pointLight);
  
  uniforms.uResolution.value.set(width, height);
  
  animate();
}

function animate() {
  if (!renderer || !scene || !camera || !mesh) return;
  
  const elapsed = (Date.now() - startTime) / 1000;
  uniforms.uTime.value = elapsed;
  uniforms.uAudioLevel.value = props.audioLevel;
  
  // Slow rotation for visual interest
  mesh.rotation.y = elapsed * 0.1;
  mesh.rotation.x = Math.sin(elapsed * 0.15) * 0.1;
  
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
}

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (renderer && containerRef.value) {
    containerRef.value.removeChild(renderer.domElement);
    renderer.dispose();
    renderer = null;
  }
  
  if (mesh) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    mesh = null;
  }
  
  scene = null;
  camera = null;
}

watch(() => props.isActive, (active) => {
  if (active && !renderer) {
    setTimeout(initThreeJS, 100);
  } else if (!active && renderer) {
    cleanup();
  }
});

watch(() => props.audioLevel, (level) => {
  uniforms.uAudioLevel.value = level;
});

onMounted(() => {
  if (props.isActive) {
    setTimeout(initThreeJS, 100);
  }
});

onUnmounted(() => {
  cleanup();
});
</script>

<template>
  <div 
    ref="containerRef" 
    class="liquid-orb-container"
  />
</template>

<style scoped>
.liquid-orb-container {
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.liquid-orb-container :deep(canvas) {
  display: block;
}
</style>

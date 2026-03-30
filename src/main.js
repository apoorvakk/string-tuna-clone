import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import gsap from "gsap"
import fragmentShader from "./shaders/fragment.glsl"
import vertexShader from "./shaders/vertex.glsl"
import rippleFragmentShader from "./shaders/rippleFragment.glsl"
import rippleVertexShader from "./shaders/rippleVertex.glsl"

let scene, camera, renderer, sword, composer, ripplePass
let canMove = false
const mouse = { x: 0, y: 0 }
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
})

const shaderContext = {
  uTime: { value: 0 },
  uBlackout: { value: 0.0 },
  uRippleAmplitude: { value: 0.0 },
  uRippleFrequency: { value: 0.0 },
  uRippleProgress: { value: 0.0 }
}

init()
animate()

function init() {
  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, -1.5, 8)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  document.body.appendChild(renderer.domElement)

  // --- Post-processing setup ---
  // Using Linear color space here (default) to keep the pipeline linear
  // and handle the final sRGB conversion in the OutputPass.
  const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth, window.innerHeight,
    {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    }
  )
  composer = new EffectComposer(renderer, renderTarget)
  composer.addPass(new RenderPass(scene, camera))

  const RippleShader = {
    uniforms: {
      tDiffuse: { value: null },
      uRippleTime: { value: 0 },
      uRippleAmplitude: shaderContext.uRippleAmplitude,
      uRippleFrequency: shaderContext.uRippleFrequency,
      uRippleProgress: shaderContext.uRippleProgress,
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: rippleVertexShader,
    fragmentShader: rippleFragmentShader
  }

  ripplePass = new ShaderPass(RippleShader)
  composer.addPass(ripplePass)

  // Final OutputPass handles tonemapping and color space conversion
  const outputPass = new OutputPass()
  composer.addPass(outputPass)

  const mainLight = new THREE.DirectionalLight(0xffffff, 4)
  mainLight.position.set(5, 10, 5)
  scene.add(mainLight)

  const checkLight = new THREE.DirectionalLight(0xffffff, 2)
  checkLight.position.set(-5, -5, -5)
  scene.add(checkLight)

  const rimLight = new THREE.DirectionalLight(0xaabbfc, 4)
  rimLight.position.set(0, 5, -10)
  scene.add(rimLight)

  const ambient = new THREE.AmbientLight(0xffffff, 1.5)
  scene.add(ambient)

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  const textureLoader = new THREE.TextureLoader()

  const loadTexture = (path, isColor = false) => {
    const tex = textureLoader.load(path)
    tex.flipY = true
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const katanaColor = loadTexture('/Katana_and_sheath_M_Katana_BaseColor.1001.jpg', true)
  const katanaNormal = loadTexture('/Katana_and_sheath_M_Katana_Normal.1001.jpg')
  const katanaMetallic = loadTexture('/Katana_and_sheath_M_Katana_Metallic.1001.jpg')
  const katanaRoughness = loadTexture('/Katana_and_sheath_M_Katana_Roughness.1001.jpg')
  const katanaHeight = loadTexture('/Katana_and_sheath_M_Katana_Height.1001.jpg')

  const sheathColor = loadTexture('/Katana_and_sheath_M_Sheath_BaseColor.1001.jpg', true)
  const sheathNormal = loadTexture('/Katana_and_sheath_M_Sheath_Normal.1001.jpg')
  const sheathMetallic = loadTexture('/Katana_and_sheath_M_Sheath_Metallic.1001.jpg')
  const sheathRoughness = loadTexture('/Katana_and_sheath_M_Sheath_Roughness.1001.jpg')
  const sheathHeight = loadTexture('/Katana_and_sheath_M_Sheath_Height.1001.jpg')

  loader.load("/katana.glb", (gltf) => {
    sword = gltf.scene

    sword.traverse((child) => {
      const hiddenBoxes = ['Box_1_sheath', 'Box_2_sheath', 'Box_1_Katana', 'Box_2_Katana']

      if (child.isMesh) {
        if (hiddenBoxes.includes(child.name)) {
          child.material = new THREE.MeshBasicMaterial({ visible: false })
        } else {
          let mat = new THREE.MeshStandardMaterial()

          if (child.name === 'KATANA') {
            mat.map = katanaColor
            mat.normalMap = katanaNormal
            mat.metalnessMap = katanaMetallic
            mat.roughnessMap = katanaRoughness
            mat.displacementMap = katanaHeight
            mat.displacementScale = 0.005
          } else if (child.name === 'sheath') {
            mat.map = sheathColor
            mat.normalMap = sheathNormal
            mat.metalnessMap = sheathMetallic
            mat.roughnessMap = sheathRoughness
            mat.displacementMap = sheathHeight
            mat.displacementScale = 0.005
          }

          if (mat.map) {
            mat.onBeforeCompile = (shader) => {
              shader.uniforms.uTime = shaderContext.uTime
              shader.uniforms.uBlackout = shaderContext.uBlackout

              const commonUniforms = `
                #include <common>
                uniform float uTime;
                uniform float uBlackout;
              `

              const fragmentFunctions = `
                float sword_rand(vec2 n) { 
                  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                }

                float sword_calcNoise(vec2 p){
                  vec2 ip = floor(p);
                  vec2 u = fract(p);
                  u = u * u * (3.0 - 2.0 * u);
                  
                  float res = mix(
                    mix(sword_rand(ip), sword_rand(ip + vec2(1.0, 0.0)), u.x),
                    mix(sword_rand(ip + vec2(0.0, 1.0)), sword_rand(ip + vec2(1.0, 1.0)), u.x), u.y);
                  return res * res;
                }

                float sword_calcFBM(vec2 p) {
                  float v = 0.0;
                  float a = 0.5;
                  vec2 shift = vec2(100.0);
                  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                  for (int i = 0; i < 5; ++i) {
                    v += a * sword_calcNoise(p);
                    p = rot * p * 2.0 + shift;
                    a *= 0.5;
                  }
                  return v;
                }
              `

              shader.vertexShader = shader.vertexShader.replace('#include <common>', commonUniforms)
              shader.fragmentShader = shader.fragmentShader.replace('#include <common>', commonUniforms + "\n" + fragmentFunctions)

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>\n${fragmentShader}`
              )

              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\n${vertexShader}`
              )
            }
          }

          child.material = mat
        }
      }
    })

    const box = new THREE.Box3().setFromObject(sword)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    sword.position.sub(center)

    const baseScale = 10 / size.length()
    sword.scale.setScalar(baseScale)
    sword.rotation.set(0, 0, 0)

    scene.add(sword)

    sword.scale.set(-baseScale, -baseScale, baseScale)
    sword.position.z -= 2

    const tl = gsap.timeline({ delay: 1.2 })

    tl.to(sword.scale, {
      x: -baseScale,
      y: -baseScale,
      z: baseScale,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.rotation, {
      x: Math.PI / 7,
      z: Math.PI / 7,
      y: Math.PI / 9,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.position, {
      x: "-=2.2",
      z: "+=9",
      y: "-=1.3",
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(shaderContext.uBlackout, {
      value: 1.0,
      duration: .5,
      ease: "power3.inOut"
    }, 0)

    // --- Single huge wave pulse ---
    const rippleTl = gsap.timeline({ 
      delay: 2.7,
      onComplete: () => { canMove = true }
    })

    // Huge wave radius expansion (0 → 1.5 for full screen coverage)
    rippleTl.to(shaderContext.uRippleProgress, {
      value: 1.5,
      duration: .9,
      ease: "power2.out"
    }, 0)

    // Pulse amplitude (0 → 5.0 → 0 to fade it out at the end)
    rippleTl.to(shaderContext.uRippleAmplitude, {
      value: 5.0,
      duration: 0.2,
      ease: "power2.out"
    }, 0)
    rippleTl.to(shaderContext.uRippleAmplitude, {
      value: 0.0,
      duration: .6,
      ease: "power3.in"
    }, 0.3)

    const katanaMesh = sword.getObjectByName('KATANA')
    const sheathMesh = sword.getObjectByName('sheath')

    if (katanaMesh) {
      const initialX = katanaMesh.position.x
      const moveDistance = size.length() * -5.5

      tl.to(katanaMesh.position, {
        x: initialX + moveDistance,
        duration: 1.5,
        ease: "power2.out"
      }, 0)
    }

    if (sheathMesh) {
      // no GUI, no change needed
    }
  })

  window.addEventListener("resize", onResize)
}

function animate() {
  requestAnimationFrame(animate)

  const elapsed = performance.now() * 0.001
  shaderContext.uTime.value = elapsed

  // Update ripple post-processing uniforms
  if (ripplePass) {
    ripplePass.uniforms.uRippleTime.value = elapsed
    ripplePass.uniforms.uRippleAmplitude.value = shaderContext.uRippleAmplitude.value
    ripplePass.uniforms.uRippleFrequency.value = shaderContext.uRippleFrequency.value
    ripplePass.uniforms.uRippleProgress.value = shaderContext.uRippleProgress.value
  }

  // Interactive Mouse Parallax
  if (sword && canMove) {
    const targetRotX = Math.PI / 7 + mouse.y * 0.2
    const targetRotY = Math.PI / 9 + mouse.x * 0.2
    const targetPosX = -2.2 + mouse.x * 0.15
    const targetPosY = -1.3 + mouse.y * 0.15

    sword.rotation.x += (targetRotX - sword.rotation.x) * 0.05
    sword.rotation.y += (targetRotY - sword.rotation.y) * 0.05
    sword.position.x += (targetPosX - sword.position.x) * 0.05
    sword.position.y += (targetPosY - sword.position.y) * 0.05
  }

  composer.render()
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)

  if (ripplePass) {
    ripplePass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
  }
}